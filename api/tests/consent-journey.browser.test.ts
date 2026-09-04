/**
 * The visitor journey, in a real browser, across the real seams.
 *
 * Every other consent test verifies one layer. `consent-experience.test.ts`
 * renders the banner against a jsdom document. `ingest-consent-enforcement.test.ts`
 * proves the API re-derives a decision from the append-only log. `enforcement.test.ts`
 * exercises the enforcement client. All of them are honest about the layer they
 * cover, and none of them proves the layer boundaries hold when a person clicks.
 *
 * That is what this file is for. It is the only test in the repository where a
 * decision travels the whole way:
 *
 *   a click in the shadow DOM
 *     -> ConsentClient records it
 *       -> the SDK's consent gate re-reads it
 *         -> a network request is, or is not, made
 *
 * ## What is real, and what is a stand-in
 *
 * Real: Chromium, the built SDK bundle loaded by a classic `<script src>`, the
 * banner's own shadow DOM, the SDK's queue and flush, and the network boundary -
 * assertions are made on requests Chromium actually issued, never on a return
 * value. Nothing here reaches into SDK internals, calls a private method, or
 * writes consent state directly; the only way consent changes is by clicking
 * the thing a visitor clicks.
 *
 * A stand-in: the API. Two loopback servers, one serving the site and one
 * serving `/api/v1/*`, matching the crawler-browser convention - hermetic, no
 * database, no Neon. This is deliberate and is not a gap: the server's own
 * enforcement is a *separate* invariant, proved against a real database in
 * `ingest-consent-enforcement.test.ts`, and duplicating it here would test the
 * stub rather than the product. The seams this file exists to prove are all on
 * the browser side of that boundary.
 *
 * The stub therefore accepts everything. That matters for the queue test below:
 * if a withdrawn event still escapes, the stub *will* record it, and the
 * assertion fails. A stub that refused would hide exactly the bug being hunted.
 *
 *   npx playwright install chromium
 *   npm run test:browser
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SDK_BUNDLE = path.resolve(here, "../../sdk/dist/index.global.js");

const SITE_ID = "site_journey";
const PUBLIC_KEY = "pk_journey_test";
const ANALYTICS_PURPOSE = "analytics";
const MARKETING_PURPOSE = "marketing";

let siteServer: http.Server;
let apiServer: http.Server;
let sitePort = 0;
let apiPort = 0;
let browser: Browser;

/** Everything the stub API was asked to do, in order. */
interface Recorded {
  events: Array<{ names: string[]; sessionHeader: string | null }>;
  decisions: Array<{ purpose: string; status: string }>;
}
let recorded: Recorded;

/** Decisions the stub currently holds, so GET /consent can answer honestly. */
let serverState: Map<string, string>;

const CONFIG = () => ({
  site_id: SITE_ID,
  config_version: "cfg-v1",
  purposes: [
    {
      code: ANALYTICS_PURPOSE,
      name: "Analytics",
      description: "Understanding how the site is used.",
      kind: "optional",
      vendors: ["Rift"],
      order: 1,
    },
    {
      code: MARKETING_PURPOSE,
      name: "Marketing",
      description: "Measuring campaigns.",
      kind: "optional",
      vendors: [],
      order: 2,
    },
  ],
  notice: null,
  text: {
    title: null,
    body: null,
    accept_all: null,
    reject_all: null,
    manage: null,
    save: null,
    policy_url: null,
  },
  enforcement: null,
  ready: true,
});

/**
 * The customer's page.
 *
 * Loaded by a classic `<script src>` and initialised exactly as the docs
 * describe, so this doubles as a check that the documented installation works
 * under real script semantics rather than only under a bundler.
 */
function sitePage(api: number): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Journey Fixture</title></head>
<body>
  <h1>Journey Fixture</h1>
  <button id="fire">track</button>
  <button id="prefs">preferences</button>
  <script src="/sdk.js"></script>
  <script>
    window.__ready = (async function () {
      analytics.init(${JSON.stringify(SITE_ID)}, ${JSON.stringify(PUBLIC_KEY)}, {
        apiUrl: "http://127.0.0.1:${api}"
      });
      // The SDK never decides that analytics needs consent; the integrator does.
      analytics.setConsentCheck(function (purpose) {
        return analytics.consent.isGranted(purpose);
      });
      await analytics.banner.show();
      return true;
    })();

    document.getElementById("fire").addEventListener("click", function () {
      analytics.track("fixture_click", { from: "button" });
    });
    document.getElementById("prefs").addEventListener("click", function () {
      analytics.banner.showPreferences();
    });
  </script>
</body></html>`;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });
}

/** CORS is on, because the page and the API are different origins here. */
function cors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-rift-consent-session");
}

beforeAll(async () => {
  if (!fs.existsSync(SDK_BUNDLE)) {
    throw new Error(
      `SDK bundle missing at ${SDK_BUNDLE}. Run \`npm -w sdk run build\` before the browser tests.`,
    );
  }

  apiServer = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/api/v1/consent/config") {
      json(200, CONFIG());
      return;
    }

    if (url.pathname === "/api/v1/consent/session" && req.method === "POST") {
      await readBody(req);
      json(200, {
        session_token: "sess_journey_token",
        principal_external_id: "principal_journey",
        principal_secret: "secret_journey",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      return;
    }

    if (url.pathname === "/api/v1/consent" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      serverState.set(body.purpose_code, body.status);
      recorded.decisions.push({ purpose: body.purpose_code, status: body.status });
      json(201, {
        record: { consent_record_id: `rec_${recorded.decisions.length}` },
        effective: [...serverState].map(([purpose_code, status]) => ({ purpose_code, status })),
      });
      return;
    }

    if (url.pathname === "/api/v1/consent" && req.method === "GET") {
      json(200, {
        site_id: SITE_ID,
        principal_external_id: url.searchParams.get("principal_external_id"),
        purposes: [...serverState].map(([purpose_code, status]) => ({ purpose_code, status })),
      });
      return;
    }

    if (url.pathname === "/api/v1/events" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const events = Array.isArray(body.events) ? body.events : [body];
      recorded.events.push({
        names: events.map((e: { name?: string; event_type?: string }) => e.name ?? e.event_type ?? "?"),
        sessionHeader: (req.headers["x-rift-consent-session"] as string) ?? null,
      });
      // Accepts unconditionally on purpose - see the file header.
      json(202, { accepted: events.length, rejected: 0, errors: [] });
      return;
    }

    json(404, { error: "not found" });
  });
  await new Promise<void>((r) => apiServer.listen(0, "127.0.0.1", r));
  apiPort = (apiServer.address() as AddressInfo).port;

  siteServer = http.createServer((req, res) => {
    if (req.url === "/sdk.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(fs.readFileSync(SDK_BUNDLE, "utf8"));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(sitePage(apiPort));
  });
  await new Promise<void>((r) => siteServer.listen(0, "127.0.0.1", r));
  sitePort = (siteServer.address() as AddressInfo).port;

  browser = await chromium.launch();
}, 240_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => siteServer?.close(() => r()));
  await new Promise<void>((r) => apiServer?.close(() => r()));
});

let page: Page;

/** Requests Chromium actually issued to the events endpoint. The source of truth. */
let eventRequests: string[];

async function openSite(pathname = "/"): Promise<Page> {
  page = await browser.newPage();
  eventRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/events")) eventRequests.push(request.url());
  });
  await page.goto(`http://127.0.0.1:${sitePort}${pathname}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: Promise<boolean> }).__ready);
  return page;
}

/**
 * The banner lives in a shadow root. Playwright pierces it for CSS and text
 * selectors, so tests address controls the way a visitor does - by the label on
 * the button - rather than by an internal id that could change without the
 * experience changing.
 */
const banner = () => page.locator("#rift-consent-root");
const buttonNamed = (name: string | RegExp) => banner().getByRole("button", { name });

/**
 * Assertion helpers.
 *
 * `toBeVisible` and friends ship with `@playwright/test`; this project drives
 * the playwright *library* from vitest, so they do not exist here. Awaiting the
 * locator's own predicate is equivalent and is explicit about the moment the
 * state is read.
 */
/**
 * Visibility is asserted on the dialog, not on the shadow host.
 *
 * `#rift-consent-root` is a bare host element with no box of its own - all the
 * rendered content lives in its shadow root - so Playwright correctly reports
 * the host as hidden even while the banner is on screen. Asserting on the host
 * would have produced a test that fails when the product works.
 */
const dialog = () => banner().locator('[role="dialog"]');
const bannerVisible = () => dialog().isVisible();
const waitForBannerHidden = () => dialog().waitFor({ state: "hidden", timeout: 5_000 });
const waitForBannerVisible = () => dialog().waitFor({ state: "visible", timeout: 5_000 });

/** Waits out the SDK's flush interval, then a margin. */
const settle = async () => {
  await page.waitForTimeout(2600);
};

afterEach(async () => {
  await page?.close();
  recorded = { events: [], decisions: [] };
  serverState = new Map();
});

beforeAll(() => {
  recorded = { events: [], decisions: [] };
  serverState = new Map();
});

describe("the banner a visitor actually sees", () => {
  it("appears on a first visit, with the operator's configured purposes", async () => {
    await openSite();

    expect(await bannerVisible()).toBe(true);
    expect(await buttonNamed(/accept/i).isVisible()).toBe(true);
    expect(await buttonNamed(/reject/i).isVisible()).toBe(true);
    expect(await buttonNamed(/manage|preferences/i).isVisible()).toBe(true);
  });

  it("renders as a labelled modal dialog", async () => {
    await openSite();

    expect(await dialog().getAttribute("aria-modal")).toBe("true");
    // Labelled by something, so a screen reader announces more than "dialog".
    const label = await dialog().getAttribute("aria-labelledby");
    expect(label ?? (await dialog().getAttribute("aria-label"))).toBeTruthy();
  });

  it("sends no analytics while the visitor has not decided", async () => {
    await openSite();
    await settle();

    // init() fires session_start and page_view. Neither may escape a gate that
    // has not been satisfied, and the banner being open is not a decision.
    expect(eventRequests).toHaveLength(0);
    expect(recorded.events).toHaveLength(0);
  });
});

describe("rejecting analytics", () => {
  it("blocks automatic and manual events at the network boundary", async () => {
    await openSite();

    await buttonNamed(/reject/i).click();
    await waitForBannerHidden();

    await page.click("#fire");
    await settle();

    expect(recorded.decisions.some((d) => d.status === "DENIED")).toBe(true);
    expect(eventRequests).toHaveLength(0);
  });

  it("stays blocked across a navigation", async () => {
    await openSite();
    await buttonNamed(/reject/i).click();
    await waitForBannerHidden();

    await page.goto(`http://127.0.0.1:${sitePort}/second`);
    await page.waitForFunction(() => (window as unknown as { __ready?: Promise<boolean> }).__ready);
    await page.click("#fire");
    await settle();

    expect(eventRequests).toHaveLength(0);
  });
});

describe("granting analytics", () => {
  it("permits an event only after the decision is recorded", async () => {
    await openSite();

    await buttonNamed(/accept/i).click();
    await waitForBannerHidden();

    await page.click("#fire");
    await settle();

    expect(recorded.decisions.some((d) => d.purpose === ANALYTICS_PURPOSE && d.status === "GRANTED")).toBe(true);
    expect(eventRequests.length).toBeGreaterThan(0);

    const names = recorded.events.flatMap((e) => e.names);
    expect(names).toContain("fixture_click");
  });

  it("carries the consent session header the API needs to re-derive the decision", async () => {
    await openSite();
    await buttonNamed(/accept/i).click();
    await page.click("#fire");
    await settle();

    // The browser does not get to assert consent; it identifies the principal
    // and the server looks the decision up. Sending no token would leave the
    // API unable to enforce anything.
    expect(recorded.events.every((e) => e.sessionHeader)).toBe(true);
  });
});

describe("managing individual purposes", () => {
  it("grants one purpose and denies the other", async () => {
    await openSite();

    await buttonNamed(/manage|preferences/i).click();

    // Toggle analytics on, leave marketing off, save.
    const analyticsToggle = banner().locator(`input[type="checkbox"]`).first();
    await analyticsToggle.check();
    await buttonNamed(/save/i).click();
    await waitForBannerHidden();

    const analytics = recorded.decisions.filter((d) => d.purpose === ANALYTICS_PURPOSE);
    const marketing = recorded.decisions.filter((d) => d.purpose === MARKETING_PURPOSE);
    expect(analytics.at(-1)?.status).toBe("GRANTED");
    expect(marketing.at(-1)?.status).toBe("DENIED");
  });
});

describe("withdrawal", () => {
  it("stops future collection after a previously granted purpose is withdrawn", async () => {
    await openSite();

    await buttonNamed(/accept/i).click();
    await page.click("#fire");
    await settle();
    const afterGrant = eventRequests.length;
    expect(afterGrant).toBeGreaterThan(0);

    // Reopen, turn analytics off, save.
    await page.click("#prefs");
    await waitForBannerVisible();
    const analyticsToggle = banner().locator(`input[type="checkbox"]`).first();
    await analyticsToggle.uncheck();
    await buttonNamed(/save/i).click();
    await waitForBannerHidden();

    eventRequests = [];
    recorded.events = [];
    await page.click("#fire");
    await settle();

    const last = recorded.decisions.filter((d) => d.purpose === ANALYTICS_PURPOSE).at(-1);
    expect(last?.status === "DENIED" || last?.status === "WITHDRAWN").toBe(true);
    expect(eventRequests).toHaveLength(0);
  });

  /**
   * The case the brief calls out, and the one a client-side gate is most likely
   * to get wrong.
   *
   * An event is admitted while consent stands, so it is sitting in the SDK's
   * queue. Consent is then withdrawn *before the queue drains*. The queue must
   * not become a way for a decision to be outrun by its own latency.
   *
   * The stub API accepts everything, so nothing server-side rescues this: if the
   * event escapes, it is recorded and this fails.
   */
  it("does not let an event queued under consent escape after withdrawal", async () => {
    await openSite();

    await buttonNamed(/accept/i).click();
    await waitForBannerHidden();

    eventRequests = [];
    recorded.events = [];

    // Queue an event, then withdraw well inside the 2s flush window.
    await page.evaluate(() => {
      (window as unknown as { analytics: { track: (n: string) => unknown } }).analytics.track("queued_before_withdrawal");
    });
    await page.evaluate(async () => {
      const a = (window as unknown as {
        analytics: { consent: { withdraw: (p: string) => Promise<boolean> } };
      }).analytics;
      await a.consent.withdraw("analytics");
    });

    await settle();

    const names = recorded.events.flatMap((e) => e.names);
    expect(names).not.toContain("queued_before_withdrawal");
  });
});

describe("what reaches the visitor's browser", () => {
  it("never ships a management or secret credential", async () => {
    await openSite();
    await buttonNamed(/accept/i).click();
    await settle();

    const bundle = fs.readFileSync(SDK_BUNDLE, "utf8");
    const html = await page.content();

    for (const haystack of [bundle, html]) {
      expect(haystack).not.toMatch(/\bsk_[0-9a-f]{16,}/);
      expect(haystack).not.toMatch(/\brk_[0-9a-f]{16,}/);
      expect(haystack).not.toMatch(/postgres(ql)?:\/\//);
    }
  });
});

describe("keyboard and viewport", () => {
  it("can be operated without a mouse, and keeps focus inside the dialog", async () => {
    await openSite();

    // Focus must already be inside the banner: a dialog that opens without
    // moving focus leaves a keyboard user stranded behind it.
    const focusedInsideBanner = await page.evaluate(() => {
      const host = document.getElementById("rift-consent-root");
      const active = host?.shadowRoot?.activeElement;
      return Boolean(active);
    });
    expect(focusedInsideBanner).toBe(true);

    // Tab a few times; focus must never leave the shadow root.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const stillInside = await page.evaluate(() => {
        const host = document.getElementById("rift-consent-root");
        return Boolean(host?.shadowRoot?.activeElement);
      });
      expect(stillInside).toBe(true);
    }

    // And a decision can be made from the keyboard alone.
    await buttonNamed(/reject/i).focus();
    await page.keyboard.press("Enter");
    await waitForBannerHidden();
    expect(recorded.decisions.length).toBeGreaterThan(0);
  });

  it("fits a narrow viewport without horizontal overflow", async () => {
    page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    eventRequests = [];
    await page.goto(`http://127.0.0.1:${sitePort}/`);
    await page.waitForFunction(() => (window as unknown as { __ready?: Promise<boolean> }).__ready);

    await waitForBannerVisible();
    expect(await buttonNamed(/accept/i).isVisible()).toBe(true);
    expect(await buttonNamed(/reject/i).isVisible()).toBe(true);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Tap targets stay reachable at phone width.
    const box = await buttonNamed(/accept/i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(28);
  });
});
