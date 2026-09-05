/**
 * The experiment journey, in a real browser.
 *
 * Real: Chromium, the built SDK bundle loaded by a classic `<script src>`, real
 * `localStorage`, real rendering inside a shadow root.
 *
 * A stand-in: the API. One loopback server serving both the page and
 * `/api/v1/*`, matching the convention in `consent-journey.browser.test.ts` —
 * hermetic, no database, no Neon. The server's own attribution checking is a
 * separate invariant proved against a real database in `experiment-api.test.ts`;
 * duplicating it here would test the stub rather than the product.
 *
 * The seams this file exists to prove are all on the browser side:
 *
 *   1. an arm is assigned, and the assigned copy is what actually renders;
 *   2. the arm survives a reload and a second page in the same origin;
 *   3. the decision the visitor makes carries the arm to the server;
 *   4. an impression is reported for the arm that was shown;
 *   5. the reject control is present and usable in every arm.
 *
 * The last one matters most. Every other guarantee in this subsystem is
 * structural, but "the visitor can still refuse" is the one an operator could
 * break with copy that is technically valid, and it is the one that has to hold
 * in a real rendered banner rather than in a type.
 *
 *   npx playwright install chromium
 *   npm run test:browser
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SDK_BUNDLE = path.resolve(here, "../../sdk/dist/index.global.js");

const SITE_ID = "site_experiment";
const PUBLIC_KEY = "pk_experiment_test";
const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";

/** Copy that differs enough per arm to be unambiguous in an assertion. */
const CONTROL_REJECT = "Reject all";
const VARIANT_REJECT = "No thanks";

let server: http.Server;
let port = 0;
let browser: Browser;

interface Recorded {
  impressions: Array<{ experiment_id: string; variant_key: string }>;
  decisions: Array<{ purpose: string; status: string; experiment_id?: string; variant_key?: string }>;
}
let recorded: Recorded;

function config() {
  return {
    site_id: SITE_ID,
    config_version: "cfg_experiment_1",
    ready: true,
    purposes: [
      {
        code: "analytics",
        name: "Analytics",
        description: "Understand how the site is used",
        kind: "optional",
        vendors: [],
        order: 0,
      },
    ],
    notice: null,
    text: {
      title: "We use cookies",
      body: "Choose what you are comfortable with.",
      accept_all: "Accept all",
      reject_all: CONTROL_REJECT,
      manage: "Manage",
      save: "Save",
      policy_url: null,
    },
    enforcement: null,
    // Both arms at 50, so which one a given browser lands in is decided by its
    // own key — exactly as in production. The tests below never assume which.
    experiment: {
      experiment_id: EXPERIMENT_ID,
      variants: [
        { key: "control", allocation: 50, text: null },
        { key: "b", allocation: 50, text: { reject_all: VARIANT_REJECT } },
      ],
    },
  };
}

function sitePage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Experiment Fixture</title></head>
<body>
  <h1>Experiment Fixture</h1>
  <script src="/sdk.js"></script>
  <script>
    window.__ready = (async function () {
      analytics.init(${JSON.stringify(SITE_ID)}, ${JSON.stringify(PUBLIC_KEY)}, {
        apiUrl: "http://127.0.0.1:${port}"
      });
      await analytics.banner.show();
      return true;
    })();
  </script>
</body></html>`;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1`);

    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/api/v1/consent/config") return json(200, config());

    if (url.pathname === "/api/v1/experiments/events" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      recorded.impressions.push(body);
      return json(202, { accepted: 1 });
    }

    if (url.pathname === "/api/v1/consent/session" && req.method === "POST") {
      await readBody(req);
      return json(200, {
        session_token: "sess_experiment",
        principal_external_id: "principal_experiment",
        principal_secret: "secret_experiment",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
    }

    if (url.pathname === "/api/v1/consent" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      recorded.decisions.push({
        purpose: body.purpose_code,
        status: body.status,
        experiment_id: body.experiment_id,
        variant_key: body.variant_key,
      });
      return json(201, {
        record: { consent_record_id: `rec_${recorded.decisions.length}` },
        effective: [],
      });
    }

    if (url.pathname === "/api/v1/consent" && req.method === "GET") {
      return json(200, {
        site_id: SITE_ID,
        principal_external_id: url.searchParams.get("principal_external_id"),
        purposes: [],
      });
    }

    if (url.pathname === "/api/v1/events" && req.method === "POST") {
      await readBody(req);
      return json(202, { accepted: 1 });
    }

    if (url.pathname === "/sdk.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(fs.readFileSync(SDK_BUNDLE, "utf8"));
    }

    // Any path serves the fixture, so a "second page" is a real navigation to a
    // different URL in the same origin rather than a reload in disguise.
    res.writeHead(200, { "content-type": "text/html" });
    res.end(sitePage());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;

  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  recorded = { impressions: [], decisions: [] };
});

let page: Page;

afterEach(async () => {
  await page?.context()?.close();
});

async function open(pathname = "/"): Promise<Page> {
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}${pathname}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: unknown }).__ready);
  // `attached`, not `visible`: the host is a zero-size div and the banner lives
  // inside its shadow root, so waiting for visibility here waits forever.
  await page.waitForSelector("#rift-consent-root", { state: "attached" });
  await page.waitForFunction(() =>
    Boolean(document.getElementById("rift-consent-root")?.shadowRoot?.querySelector("button")),
  );
  return page;
}

/** The reject control's label, read from inside the shadow root. */
async function rejectLabel(target: Page): Promise<string> {
  return target.evaluate(() => {
    const host = document.getElementById("rift-consent-root");
    const root = host?.shadowRoot;
    const buttons = [...(root?.querySelectorAll("button") ?? [])];
    // The secondary button in the banner is the reject control.
    return buttons.map((b) => b.textContent?.trim() ?? "").join("|");
  });
}

async function assignedKey(target: Page): Promise<string | null> {
  return target.evaluate(() => window.localStorage.getItem("rift.experiment.key"));
}

// ─── Assignment reaches the rendered banner ──────────────────────────────────

describe("a visitor is assigned an arm and sees it", () => {
  it("renders one of the two arms' copy, and only one", async () => {
    const target = await open();
    const labels = await rejectLabel(target);

    // Whichever arm this browser landed in, exactly one reject label is shown.
    const isControl = labels.includes(CONTROL_REJECT);
    const isVariant = labels.includes(VARIANT_REJECT);
    expect(isControl !== isVariant).toBe(true);
  });

  it("mints a browser key and keeps it local", async () => {
    const target = await open();
    expect(await assignedKey(target)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("reports an impression for the arm it showed", async () => {
    const target = await open();
    await target.waitForFunction(
      () => true,
      undefined,
      { timeout: 1000 },
    ).catch(() => undefined);

    // Fire-and-forget, so give it a moment to land.
    await target.waitForTimeout(500);

    expect(recorded.impressions.length).toBeGreaterThan(0);
    expect(recorded.impressions[0]?.experiment_id).toBe(EXPERIMENT_ID);
    expect(["control", "b"]).toContain(recorded.impressions[0]?.variant_key);
  });
});

// ─── Stickiness ──────────────────────────────────────────────────────────────

describe("the arm sticks", () => {
  it("survives a reload", async () => {
    const target = await open();
    const before = await rejectLabel(target);
    const key = await assignedKey(target);

    await target.reload();
    await target.waitForFunction(() => (window as unknown as { __ready?: unknown }).__ready);
    await target.waitForSelector("#rift-consent-root", { state: "attached" });
    await target.waitForFunction(() =>
      Boolean(document.getElementById("rift-consent-root")?.shadowRoot?.querySelector("button")),
    );

    expect(await rejectLabel(target)).toBe(before);
    expect(await assignedKey(target)).toBe(key);
  });

  it("survives a navigation to a second page", async () => {
    // A different URL in the same origin: a real navigation, sharing storage.
    const target = await open("/");
    const before = await rejectLabel(target);

    await target.goto(`http://127.0.0.1:${port}/second-page`);
    await target.waitForFunction(() => (window as unknown as { __ready?: unknown }).__ready);
    await target.waitForSelector("#rift-consent-root", { state: "attached" });
    await target.waitForFunction(() =>
      Boolean(document.getElementById("rift-consent-root")?.shadowRoot?.querySelector("button")),
    );

    expect(await rejectLabel(target)).toBe(before);
  });

  it("reassigns a browser with different storage", async () => {
    // Two independent contexts have independent storage, which is what makes a
    // 50/50 split reach both arms at all.
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const target = await open();
      seen.add(await rejectLabel(target));
      await target.context().close();
    }

    // Both arms appear across twelve fresh browsers. A one-armed result here
    // would mean assignment is not actually varying.
    expect(seen.size).toBe(2);
  });
});

// ─── The decision carries the arm ────────────────────────────────────────────

describe("a decision is attributed", () => {
  it("sends the experiment and arm with every recorded decision", async () => {
    const target = await open();

    await target.evaluate(() => {
      const root = document.getElementById("rift-consent-root")?.shadowRoot;
      const buttons = [...(root?.querySelectorAll("button") ?? [])];
      const accept = buttons.find((b) => b.textContent?.includes("Accept all"));
      (accept as HTMLButtonElement | undefined)?.click();
    });

    await target.waitForTimeout(1000);

    expect(recorded.decisions.length).toBeGreaterThan(0);
    for (const decision of recorded.decisions) {
      expect(decision.experiment_id).toBe(EXPERIMENT_ID);
      expect(["control", "b"]).toContain(decision.variant_key);
    }
  });

  it("attributes to the same arm that was rendered", async () => {
    const target = await open();
    const labels = await rejectLabel(target);
    const rendered = labels.includes(VARIANT_REJECT) ? "b" : "control";

    await target.evaluate(() => {
      const root = document.getElementById("rift-consent-root")?.shadowRoot;
      const buttons = [...(root?.querySelectorAll("button") ?? [])];
      (buttons[0] as HTMLButtonElement | undefined)?.click();
    });
    await target.waitForTimeout(1000);

    // The attribution and the rendering must agree, or every result in the
    // dashboard is describing a banner somebody else saw.
    expect(recorded.decisions[0]?.variant_key).toBe(rendered);
  });
});

// ─── Refusal survives every arm ──────────────────────────────────────────────

describe("the visitor can still refuse", () => {
  it("renders a reject control in whichever arm is shown", async () => {
    const target = await open();
    const labels = await rejectLabel(target);

    // Present, non-empty, and one of the two expected labels — an experiment may
    // reword refusal, and this is where "may not remove it" has to hold in a
    // real rendered banner rather than in a type.
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.includes(CONTROL_REJECT) || labels.includes(VARIANT_REJECT)).toBe(true);
  });

  it("records a refusal when the reject control is used", async () => {
    const target = await open();

    await target.evaluate(
      ([control, variant]) => {
        const root = document.getElementById("rift-consent-root")?.shadowRoot;
        const buttons = [...(root?.querySelectorAll("button") ?? [])];
        const reject = buttons.find(
          (b) => b.textContent?.includes(control!) || b.textContent?.includes(variant!),
        );
        (reject as HTMLButtonElement | undefined)?.click();
      },
      [CONTROL_REJECT, VARIANT_REJECT],
    );

    await target.waitForTimeout(1000);

    expect(recorded.decisions.length).toBeGreaterThan(0);
    expect(recorded.decisions.every((d) => d.status !== "GRANTED")).toBe(true);
  });
});
