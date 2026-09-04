import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { detectTechnologies } from "./detectors";
import { assertNavigable, type Resolver } from "./ssrf";
import { acceptLink, isThirdParty, normaliseUrl } from "./url";
import { isAllowed, parseRobots, pathForRobots, permissivePolicy, type RobotsPolicy } from "./robots";
import {
  DEFAULT_LIMITS,
  type ConsentUiObservation,
  type ConsentUiSignal,
  type CookieObservation,
  type CrawlLimits,
  type PageObservation,
  type RequestObservation,
  type ScanMode,
  type ScanResult,
  type ScriptObservation,
  type StorageObservation,
} from "./types";

export const CRAWLER_VERSION = "1.0.0";

/**
 * The scanner identifies itself honestly and stably.
 *
 * A crawler that hides behind a browser user-agent cannot be blocked by a site
 * that does not want it, cannot be recognised in a customer's own access logs,
 * and cannot be matched by the `User-agent` group in their robots.txt. All
 * three are reasons to be identifiable rather than stealthy.
 */
export const USER_AGENT = `RiftCMP-Scanner/${CRAWLER_VERSION} (+https://rift-cmp.dev/scanner)`;

export interface CrawlOptions {
  startUrl: string;
  mode?: ScanMode;
  limits?: Partial<CrawlLimits>;
  /** Injected in tests so DNS behaviour can be exercised deterministically. */
  resolver?: Resolver;
  /**
   * Permit loopback and private targets. **Tests only.**
   *
   * The rendering half of the crawler cannot otherwise be exercised: the SSRF
   * guard refuses 127.0.0.1, so the alternative is pointing tests at the live
   * internet. Never set by the worker or reachable from the HTTP API - see the
   * note in `ssrf.ts`.
   */
  allowPrivateTargets?: boolean;
  /** Structured progress, without values or headers. See docs/crawler.md. */
  onEvent?: (event: CrawlEvent) => void;
  signal?: AbortSignal;
}

export interface CrawlEvent {
  event: string;
  url?: string;
  status?: number;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

/** Thrown only for failures that make the whole scan meaningless. */
export class ScanFatalError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ScanFatalError";
  }
}

/**
 * Cookie names that indicate a consent manager is present.
 *
 * Detecting a consent UI is *not* the same as judging it. This records that
 * something consent-shaped exists and why we think so; whether it is valid,
 * sufficient, or lawful is a question for the compliance layer and a human.
 */
/**
 * Cookie and storage key fragments that indicate a consent manager.
 *
 * Matched as substrings, case-insensitively, because CMPs suffix their keys
 * with account or property ids — Sourcepoint writes `_sp_user_consent_7417`,
 * and matching the exact string would find nobody.
 */
const CMP_STORAGE_NAMES = [
  "cookieconsent", "optanonconsent", "optanonalertboxclosed", "euconsent-v2",
  "cookielawinfo-checkbox-necessary", "borlabs-cookie", "cookie_notice_accepted",
  "cmplz_consent_status", "complianz_consent_status", "__cmpconsent",
  "consentuuid", "_sp_user_consent", "_sp_non_keyed", "usercentrics",
  "cookieyes", "didomi_token", "iub_", "osano_consentmanager", "trustarc",
];

const CMP_SCRIPT_PATTERNS = [
  "cookiebot.com", "cookielaw.org", "onetrust", "usercentrics", "cookieyes",
  "termly.io", "iubenda.com", "quantcast", "didomi.io", "trustarc.com",
  "osano.com", "complianz", "borlabs", "klaro", "cookiehub",
  // Added after a real crawl: the Guardian runs Sourcepoint and was reported as
  // having no consent interface at all.
  "sourcepoint", "sp-prod.net", "consensu.org", "privacymanager.io",
];

/** Button text that suggests a consent choice, in a few common languages. */
const CONSENT_BUTTON_TEXT = [
  "accept all", "accept cookies", "accept", "agree", "i agree", "allow all",
  "reject all", "reject", "decline", "deny",
  "manage preferences", "cookie settings", "privacy settings", "customise", "customize",
  "alle akzeptieren", "tout accepter", "aceptar todo",
];

interface Budget {
  requests: number;
  cookies: number;
  scripts: number;
  storage: number;
}

/**
 * Crawls a site and returns raw observations.
 *
 * This function performs **no persistence and no classification of legality**.
 * It returns what it saw; the worker persists it and the compliance layer, owned
 * by another person, decides what any of it means.
 */
export async function crawl(options: CrawlOptions): Promise<ScanResult> {
  const limits: CrawlLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const mode: ScanMode = options.mode ?? "baseline";
  const emit = options.onEvent ?? (() => {});
  const startedAt = new Date();
  const deadline = startedAt.getTime() + limits.maxDurationMs;

  // ── 1. Validate the entry point before starting a browser ──────────────────
  const entry = normaliseUrl(options.startUrl);
  if (!entry.ok) {
    throw new ScanFatalError(`Start URL rejected: ${entry.reason}`, "invalid_start_url");
  }

  const guard = await assertNavigable(entry.url, {
    resolver: options.resolver,
    allowPrivateTargets: options.allowPrivateTargets,
  });
  if (!guard.allowed) {
    // Deliberately fatal. A start URL pointing at private space is not a page
    // failure to be recorded and stepped over; it is a request we must refuse.
    throw new ScanFatalError(
      `Start URL rejected by the SSRF guard: ${guard.reason} (${guard.detail})`,
      "ssrf_blocked",
    );
  }

  const scopeOrigin = new URL(entry.url).origin;

  // ── 2. robots.txt ──────────────────────────────────────────────────────────
  const robots = await fetchRobots(scopeOrigin, emit);
  let disallowedSkipped = 0;

  // ── 3. Browser ─────────────────────────────────────────────────────────────
  let browser: Browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  } catch (error) {
    throw new ScanFatalError(
      `Could not start the browser: ${(error as Error).message}`,
      "browser_launch_failed",
    );
  }

  // One context per scan. Never reused across scans: cookies and storage from
  // one customer's site must not be visible while scanning another's.
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    ignoreHTTPSErrors: false,
    viewport: { width: 1366, height: 900 },
    serviceWorkers: "block",
  });

  const pages: PageObservation[] = [];
  const requests: RequestObservation[] = [];
  const scripts: ScriptObservation[] = [];
  const storage: StorageObservation[] = [];
  const consentSignals: ConsentUiSignal[] = [];
  let consentSeenOn: string | null = null;

  const budget: Budget = { requests: 0, cookies: 0, scripts: 0, storage: 0 };
  let limitReached: string | null = null;
  const noteLimit = (name: string) => {
    if (!limitReached) limitReached = name;
  };

  const queue: Array<{ url: string; depth: number }> = [{ url: entry.url, depth: 0 }];
  const seen = new Set<string>([entry.url]);
  let discovered = 1;

  try {
    while (queue.length > 0) {
      if (options.signal?.aborted) {
        noteLimit("cancelled");
        break;
      }
      if (Date.now() > deadline) {
        noteLimit("maxDuration");
        emit({ event: "limit_reached", limit: "maxDuration" });
        break;
      }
      if (pages.length >= limits.maxPages) {
        noteLimit("maxPages");
        emit({ event: "limit_reached", limit: "maxPages" });
        break;
      }

      // Concurrency is a slice of the queue rather than a worker pool: the
      // queue is short-lived and bounded, and a pool would add failure modes
      // for no throughput that matters at these limits.
      //
      // The slice is also capped by what is left of the page budget. Taking a
      // full batch and checking the limit only at the top of the loop
      // overshoots `maxPages` by up to `concurrency - 1`: with a budget of 2 and
      // a concurrency of 2, the first pass visits the entry page and the second
      // takes two more, for three. A page limit that a caller can exceed is not
      // a limit, and this is the only bound between a hostile site and the
      // crawl budget it can consume.
      const remaining = limits.maxPages - pages.length;
      const batch = queue.splice(0, Math.max(1, Math.min(limits.concurrency, remaining)));

      const results = await Promise.all(
        batch.map((item) =>
          visitPage(context, item.url, item.depth, {
            limits,
            scopeOrigin,
            robots,
            resolver: options.resolver,
            allowPrivateTargets: options.allowPrivateTargets,
            budget,
            noteLimit,
            emit,
          }),
        ),
      );

      for (const result of results) {
        pages.push(result.page);
        requests.push(...result.requests);
        scripts.push(...result.scripts);
        storage.push(...result.storage);
        if (result.consentSignals.length > 0 && !consentSeenOn) {
          consentSeenOn = result.page.url;
          consentSignals.push(...result.consentSignals);
        }
        disallowedSkipped += result.disallowedSkipped;

        for (const link of result.links) {
          if (seen.has(link)) continue;
          if (result.page.depth + 1 > limits.maxDepth) continue;
          if (discovered >= limits.maxPages * 4) {
            // Bound the queue itself, not only what we visit: a link farm can
            // otherwise exhaust memory long before the page limit is reached.
            noteLimit("queueBound");
            break;
          }
          seen.add(link);
          discovered += 1;
          queue.push({ url: link, depth: result.page.depth + 1 });
        }
      }

      if (robots.crawlDelaySeconds && queue.length > 0) {
        await sleep(Math.min(robots.crawlDelaySeconds * 1000, 10_000));
      }
    }

    // ── 4. Cookies, read once from the context at the end ────────────────────
    const cookies = await collectCookies(context, scopeOrigin, limits, budget, noteLimit);

    const technologies = detectTechnologies(
      { requests, scripts, cookies, storage },
      { maxEvidencePerFinding: limits.maxEvidencePerFinding },
    );

    const thirdPartyDomains = new Set(
      requests.filter((request) => request.isThirdParty).map((request) => request.host),
    );

    // Cookies and storage are the most reliable consent-manager signal, and the
    // only one that survives a banner the crawler never saw: a returning visitor
    // is not shown the dialog, and a CMP loaded inside an iframe leaves nothing
    // matchable in the top document. Both are only known once the crawl is over,
    // which is why this runs here rather than per page.
    //
    // The first real crawl found this missing entirely: a site running
    // Sourcepoint reported `consent_ui_detected: false` while writing a
    // `consentUUID` cookie and three `_sp_*` storage keys.
    for (const cookie of cookies) {
      const name = cookie.name.toLowerCase();
      if (CMP_STORAGE_NAMES.some((pattern) => name.includes(pattern))) {
        consentSignals.push({ kind: "known_cmp_cookie", detail: cookie.name });
      }
    }
    for (const item of storage) {
      const name = item.name.toLowerCase();
      if (CMP_STORAGE_NAMES.some((pattern) => name.includes(pattern))) {
        consentSignals.push({ kind: "known_cmp_cookie", detail: `${item.kind}:${item.name}` });
      }
    }

    const completedAt = new Date();

    const deduplicatedSignals = consentSignals.filter(
      (signal, index) =>
        consentSignals.findIndex((s) => s.kind === signal.kind && s.detail === signal.detail) === index,
    );

    const consentUi: ConsentUiObservation = {
      detected: deduplicatedSignals.length > 0,
      signals: deduplicatedSignals.slice(0, 10),
      observedOn: consentSeenOn,
    };

    return {
      startUrl: entry.url,
      mode,
      crawlerVersion: CRAWLER_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      limits,
      robots: {
        source: robots.source,
        crawlDelaySeconds: robots.crawlDelaySeconds,
        disallowedSkipped,
      },
      pages,
      cookies,
      scripts,
      requests,
      storage,
      consentUi,
      technologies,
      summary: {
        pagesDiscovered: discovered,
        pagesScanned: pages.filter((page) => page.rendered).length,
        pagesFailed: pages.filter((page) => !page.rendered).length,
        cookiesFound: cookies.length,
        scriptsFound: scripts.length,
        requestsObserved: requests.length,
        storageItemsFound: storage.length,
        thirdPartyDomains: thirdPartyDomains.size,
        technologiesDetected: technologies.length,
        consentUiDetected: consentUi.detected,
        limitReached,
      },
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

interface VisitContext {
  limits: CrawlLimits;
  scopeOrigin: string;
  robots: RobotsPolicy;
  resolver?: Resolver;
  allowPrivateTargets?: boolean;
  budget: Budget;
  noteLimit: (name: string) => void;
  emit: (event: CrawlEvent) => void;
}

interface VisitResult {
  page: PageObservation;
  requests: RequestObservation[];
  scripts: ScriptObservation[];
  storage: StorageObservation[];
  links: string[];
  consentSignals: ConsentUiSignal[];
  disallowedSkipped: number;
}

/**
 * Renders one page and records what it did.
 *
 * A failure here is recorded and returned, never thrown: one page timing out
 * must not lose the other ninety-nine pages' observations.
 */
async function visitPage(
  context: BrowserContext,
  url: string,
  depth: number,
  ctx: VisitContext,
): Promise<VisitResult> {
  const startedAt = new Date();
  const requests: RequestObservation[] = [];
  const scripts: ScriptObservation[] = [];
  const storage: StorageObservation[] = [];
  const consentSignals: ConsentUiSignal[] = [];
  let links: string[] = [];
  let disallowedSkipped = 0;

  const base: PageObservation = {
    url,
    finalUrl: null,
    status: null,
    title: null,
    contentType: null,
    depth,
    redirectChain: [],
    rendered: false,
    error: null,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
  };

  const finish = (page: PageObservation): VisitResult => ({
    page: { ...page, durationMs: Date.now() - startedAt.getTime() },
    requests,
    scripts,
    storage,
    links,
    consentSignals,
    disallowedSkipped,
  });

  if (!isAllowed(ctx.robots, pathForRobots(url))) {
    disallowedSkipped += 1;
    ctx.emit({ event: "page_skipped_robots", url });
    return finish({ ...base, error: "disallowed_by_robots" });
  }

  // Re-checked per page, not once per scan: a link or redirect is an
  // attacker-controlled path from an allowed origin to a disallowed one.
  const guard = await assertNavigable(url, {
    resolver: ctx.resolver,
    allowPrivateTargets: ctx.allowPrivateTargets,
  });
  if (!guard.allowed) {
    ctx.emit({ event: "page_skipped_ssrf", url, error: guard.reason });
    return finish({ ...base, error: `ssrf_blocked:${guard.reason}` });
  }

  let page: Page;
  try {
    page = await context.newPage();
  } catch (error) {
    return finish({ ...base, error: `page_open_failed: ${(error as Error).message}` });
  }

  const pageOrigin = new URL(url).origin;

  // ── Network observation ─────────────────────────────────────────────────
  // Metadata only. No headers are read, no bodies are touched, and the URL is
  // stripped of query and fragment *at capture* so an identifier is never held
  // in memory as part of an observation.
  page.on("request", (request) => {
    if (ctx.budget.requests >= ctx.limits.maxRequests) {
      ctx.noteLimit("maxRequests");
      return;
    }
    try {
      const parsed = new URL(request.url());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      ctx.budget.requests += 1;
      requests.push({
        url: `${parsed.origin}${parsed.pathname}`,
        host: parsed.hostname,
        method: request.method(),
        resourceType: request.resourceType(),
        status: null,
        isThirdParty: isThirdParty(parsed.hostname, pageOrigin),
        observedOn: url,
        failed: false,
      });

      if (request.resourceType() === "script") {
        if (ctx.budget.scripts < ctx.limits.maxScripts) {
          ctx.budget.scripts += 1;
          scripts.push({
            // Origin + path, matching how request URLs are captured above. A
            // script URL is normally harmless (`/gtag/js?id=G-X`), but a
            // first-party one can carry a session token in its query, and the
            // rule that query strings are never collected has to hold for every
            // captured URL or it is not a rule. Detection is unaffected: every
            // script signature matches on the path.
            url: `${parsed.origin}${parsed.pathname}`,
            host: parsed.hostname,
            inline: false,
            isThirdParty: isThirdParty(parsed.hostname, pageOrigin),
            observedOn: url,
          });
        } else {
          ctx.noteLimit("maxScripts");
        }
        if (CMP_SCRIPT_PATTERNS.some((pattern) => parsed.hostname.includes(pattern))) {
          consentSignals.push({ kind: "known_cmp_script", detail: parsed.hostname });
        }
      }
    } catch {
      // A malformed request URL is not worth failing a page over.
    }
  });

  page.on("response", (response) => {
    const target = requests.find(
      (item) => item.status === null && response.url().startsWith(item.url),
    );
    if (target) target.status = response.status();
  });

  page.on("requestfailed", (request) => {
    const target = requests.find((item) => request.url().startsWith(item.url));
    if (target) target.failed = true;
  });

  // ── Navigate ────────────────────────────────────────────────────────────
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: ctx.limits.navigationTimeoutMs,
    });

    const chain = redirectChain(response);
    if (chain.length > ctx.limits.maxRedirects) {
      await page.close().catch(() => {});
      return finish({ ...base, redirectChain: chain, error: "too_many_redirects" });
    }

    // Any redirect could have crossed into private space. Check where we
    // actually landed, not only where we intended to go.
    const landed = page.url();
    if (landed !== url) {
      const landedGuard = await assertNavigable(landed, {
        resolver: ctx.resolver,
        allowPrivateTargets: ctx.allowPrivateTargets,
      });
      if (!landedGuard.allowed) {
        await page.close().catch(() => {});
        return finish({
          ...base,
          finalUrl: landed,
          redirectChain: chain,
          error: `ssrf_blocked_after_redirect:${landedGuard.reason}`,
        });
      }
    }

    await stabilise(page, ctx.limits.stabilisationMs);

    const contentType = response?.headers()["content-type"] ?? null;
    const title = await page.title().catch(() => null);

    // ── Storage: key names only ─────────────────────────────────────────
    const storageKeys = await readStorageKeys(page);
    for (const item of storageKeys) {
      if (ctx.budget.storage >= ctx.limits.maxStorageItems) {
        ctx.noteLimit("maxStorageItems");
        break;
      }
      ctx.budget.storage += 1;
      storage.push({ ...item, origin: pageOrigin, observedOn: url });
    }

    // ── Inline scripts and consent UI ───────────────────────────────────
    const domSignals = await readDomSignals(page);
    if (domSignals.inlineScripts > 0 && ctx.budget.scripts < ctx.limits.maxScripts) {
      ctx.budget.scripts += 1;
      scripts.push({
        url: null,
        host: null,
        inline: true,
        isThirdParty: false,
        observedOn: url,
      });
    }
    for (const text of domSignals.consentButtons) {
      consentSignals.push({ kind: "button_text", detail: text });
    }
    if (domSignals.consentDomPattern) {
      consentSignals.push({ kind: "dom_pattern", detail: domSignals.consentDomPattern });
    }

    links = await collectLinks(page, url, ctx.scopeOrigin);

    await page.close().catch(() => {});

    ctx.emit({
      event: "page_scanned",
      url,
      status: response?.status(),
      durationMs: Date.now() - startedAt.getTime(),
    });

    return finish({
      ...base,
      finalUrl: landed === url ? null : landed,
      status: response?.status() ?? null,
      title,
      contentType,
      redirectChain: chain,
      rendered: true,
    });
  } catch (error) {
    await page.close().catch(() => {});
    const message = (error as Error).message.slice(0, 300);
    ctx.emit({ event: "page_failed", url, error: message });
    return finish({ ...base, error: message });
  }
}

/**
 * Waits for the page to settle, with a hard ceiling.
 *
 * `networkidle` alone is not usable: a site with a poll, a websocket or an ad
 * refresh never reaches it, and the crawl would spend its entire duration
 * budget on one page. So this races idleness against a fixed timeout and
 * accepts whichever comes first — a page that never settles is simply observed
 * as it was after the ceiling.
 */
async function stabilise(page: Page, stabilisationMs: number): Promise<void> {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: stabilisationMs }).catch(() => {}),
    sleep(stabilisationMs),
  ]);
}

/** Reads storage **key names**. Values are never read into this process. */
async function readStorageKeys(
  page: Page,
): Promise<Array<{ kind: StorageObservation["kind"]; name: string }>> {
  try {
    return await page.evaluate(() => {
      const found: Array<{ kind: "local_storage" | "session_storage" | "indexed_db"; name: string }> = [];
      const cap = 200;
      try {
        for (let i = 0; i < Math.min(localStorage.length, cap); i += 1) {
          const key = localStorage.key(i);
          if (key) found.push({ kind: "local_storage", name: key });
        }
      } catch {
        /* storage can be blocked; observing less is fine */
      }
      try {
        for (let i = 0; i < Math.min(sessionStorage.length, cap); i += 1) {
          const key = sessionStorage.key(i);
          if (key) found.push({ kind: "session_storage", name: key });
        }
      } catch {
        /* ignored */
      }
      return found;
    });
  } catch {
    return [];
  }
}

async function readDomSignals(page: Page): Promise<{
  inlineScripts: number;
  consentButtons: string[];
  consentDomPattern: string | null;
}> {
  try {
    return await page.evaluate((phrases: string[]) => {
      const inlineScripts = document.querySelectorAll("script:not([src])").length;

      const buttons = Array.from(
        document.querySelectorAll('button, a[role="button"], [type="button"], [role="button"]'),
      ).slice(0, 300);

      const consentButtons: string[] = [];
      for (const element of buttons) {
        const text = (element.textContent ?? "").trim().toLowerCase().slice(0, 60);
        if (!text) continue;
        if (phrases.some((phrase) => text === phrase || text.includes(phrase))) {
          if (!consentButtons.includes(text)) consentButtons.push(text);
        }
        if (consentButtons.length >= 5) break;
      }

      const selectors = [
        "#onetrust-banner-sdk", "#CybotCookiebotDialog", "#usercentrics-root",
        "[id*='cookie-banner']", "[class*='cookie-banner']", "[id*='cookie-consent']",
        "[class*='cookie-consent']", "[aria-label*='cookie' i]", "#cookiescript_injected",
      ];
      let consentDomPattern: string | null = null;
      for (const selector of selectors) {
        try {
          if (document.querySelector(selector)) {
            consentDomPattern = selector;
            break;
          }
        } catch {
          /* invalid selector in an old engine */
        }
      }

      return { inlineScripts, consentButtons, consentDomPattern };
    }, CONSENT_BUTTON_TEXT);
  } catch {
    return { inlineScripts: 0, consentButtons: [], consentDomPattern: null };
  }
}

async function collectLinks(page: Page, base: string, scopeOrigin: string): Promise<string[]> {
  let hrefs: string[] = [];
  try {
    hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 500)
        .map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href") ?? "")
        .filter(Boolean),
    );
  } catch {
    return [];
  }

  const accepted = new Set<string>();
  for (const href of hrefs) {
    const result = acceptLink(href, base, scopeOrigin);
    if (result.ok) accepted.add(result.url);
  }
  return [...accepted];
}

/**
 * Reads cookies from the context.
 *
 * **Values are dropped here and never leave this function.** Playwright returns
 * them whether we want them or not, so the discard is explicit and happens at
 * the boundary rather than at the database.
 */
async function collectCookies(
  context: BrowserContext,
  scopeOrigin: string,
  limits: CrawlLimits,
  budget: Budget,
  noteLimit: (name: string) => void,
): Promise<CookieObservation[]> {
  let raw: Awaited<ReturnType<BrowserContext["cookies"]>>;
  try {
    raw = await context.cookies();
  } catch {
    return [];
  }

  const observations: CookieObservation[] = [];
  for (const cookie of raw) {
    if (budget.cookies >= limits.maxCookies) {
      noteLimit("maxCookies");
      break;
    }
    budget.cookies += 1;
    observations.push({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires:
        cookie.expires && cookie.expires > 0
          ? new Date(cookie.expires * 1000).toISOString()
          : null,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite ?? null,
      isThirdParty: isThirdParty(cookie.domain.replace(/^\./, ""), scopeOrigin),
      firstSeenOn: scopeOrigin,
    });
  }
  return observations;
}

/** Fetches robots.txt with a short timeout; unreachable means permissive. */
async function fetchRobots(
  origin: string,
  emit: (event: CrawlEvent) => void,
): Promise<RobotsPolicy> {
  const url = `${origin}/robots.txt`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (response.status === 404) {
      emit({ event: "robots_absent", url });
      return permissivePolicy("absent");
    }
    if (!response.ok) {
      emit({ event: "robots_unreachable", url, status: response.status });
      return permissivePolicy("unreachable");
    }

    const body = await response.text();
    // A robots.txt larger than this is not a robots.txt.
    if (body.length > 512_000) return permissivePolicy("malformed");

    const policy = parseRobots(body, USER_AGENT);
    emit({ event: "robots_fetched", url, rules: policy.rules.length });
    return policy;
  } catch (error) {
    emit({ event: "robots_unreachable", url, error: (error as Error).message });
    return permissivePolicy("unreachable");
  }
}

function redirectChain(response: Awaited<ReturnType<Page["goto"]>>): string[] {
  const chain: string[] = [];
  let current = response?.request().redirectedFrom();
  while (current) {
    chain.unshift(current.url());
    current = current.redirectedFrom();
  }
  return chain;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
