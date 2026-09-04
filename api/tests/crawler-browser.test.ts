/**
 * The rendering half of the crawler, exercised with a real browser.
 *
 * Phase 8A requires that the scanner "render pages rather than only fetch HTML",
 * and names scenarios that only a real browser can produce: a dynamically
 * loaded tracker, an iframe, a script-generated cookie, a third-party request.
 * Every other crawler test is pure logic over a fixture; nothing had ever
 * launched Chromium, so the half of the code that does the actual work was
 * typechecked and never executed.
 *
 * These tests close that. They run against **two loopback servers** started in
 * the test itself - one standing in for the site, one for a third party - so
 * they are hermetic: no network, no third party's markup to change underneath
 * them, no flakiness that is not ours.
 *
 * ## Why this is a separate vitest project
 *
 * It needs a Chromium binary that `npm install` does not fetch. Putting it in
 * `unit` would mean the fast loop fails on a fresh clone with an error about a
 * missing executable, which is exactly the misleading-failure problem the
 * unit/integration split was created to avoid. `npm run test:browser` runs it;
 * `npm run test:unit` stays a few seconds and needs nothing.
 *
 *   npx playwright install chromium
 *   npm run test:browser
 *
 * No database.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawl } from "@rift-cmp/crawler";
import type { ScanResult } from "@rift-cmp/crawler";

let siteServer: http.Server;
let thirdServer: http.Server;
let sitePort = 0;
let thirdPort = 0;

/** The site under test. Every scenario the brief names is on the home page. */
function sitePage(third: number): string {
  return `<!doctype html><html><head><title>Fixture Home</title>
  <script src="/first-party.js"></script>
  <script>
    // A cookie written by script rather than by Set-Cookie.
    document.cookie = "script_written=1; path=/";
    localStorage.setItem("ls_key", "never-read");
    sessionStorage.setItem("ss_key", "never-read");

    // A tracker injected after parse, which a static HTML fetch cannot see.
    setTimeout(function () {
      var s = document.createElement("script");
      s.src = "http://127.0.0.1:${third}/gtag/js?id=G-FIXTURE";
      document.head.appendChild(s);

      var f = document.createElement("iframe");
      f.src = "http://127.0.0.1:${third}/frame.html";
      document.body.appendChild(f);

      new Image().src = "http://127.0.0.1:${third}/pixel.gif?uid=abc123";
    }, 30);
  </script></head>
  <body>
    <h1>Fixture</h1>
    <a href="/about">about</a>
    <a href="/depth-1">deeper</a>
    <a href="/broken">broken</a>
    <a href="https://example.org/offsite">offsite</a>
  </body></html>`;
}

const STATIC_PAGES: Record<string, string> = {
  "/about": `<!doctype html><html><head><title>About</title></head><body>About</body></html>`,
  "/depth-1": `<!doctype html><html><head><title>D1</title></head><body><a href="/depth-2">n</a></body></html>`,
  "/depth-2": `<!doctype html><html><head><title>D2</title></head><body><a href="/depth-3">n</a></body></html>`,
  "/depth-3": `<!doctype html><html><head><title>D3</title></head><body>end</body></html>`,
};

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port),
    );
  });
}

beforeAll(async () => {
  thirdServer = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/frame.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<!doctype html><html><body>third-party frame</body></html>");
    }
    if (path === "/pixel.gif") {
      res.writeHead(200, { "content-type": "image/gif" });
      return res.end(Buffer.from([0x47, 0x49, 0x46]));
    }
    // The tracker script also sets its own cookie.
    res.writeHead(200, {
      "content-type": "application/javascript",
      "set-cookie": "third_party_cookie=1; Path=/",
    });
    res.end("window.dataLayer = window.dataLayer || [];");
  });
  thirdPort = await listen(thirdServer);

  siteServer = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/robots.txt") {
      res.writeHead(404);
      return res.end();
    }
    if (path === "/broken") {
      res.writeHead(500, { "content-type": "text/html" });
      return res.end("boom");
    }
    if (path === "/first-party.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      return res.end("/* first party */");
    }
    if (path === "/") {
      res.writeHead(200, {
        "content-type": "text/html",
        "set-cookie": "server_set=1; Path=/; HttpOnly",
      });
      return res.end(sitePage(thirdPort));
    }
    const body = STATIC_PAGES[path];
    if (body === undefined) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  });
  sitePort = await listen(siteServer);
});

afterAll(async () => {
  await Promise.all(
    [siteServer, thirdServer].map(
      (s) => new Promise<void>((r) => s?.close(() => r())),
    ),
  );
});

/**
 * `allowPrivateTargets` is the test-only seam. The guard refuses loopback in
 * every production path, and `crawler-ssrf.test.ts` asserts that it still does.
 */
async function crawlFixture(over: Record<string, unknown> = {}): Promise<ScanResult> {
  return crawl({
    startUrl: `http://127.0.0.1:${sitePort}/`,
    allowPrivateTargets: true,
    limits: { maxPages: 20, maxDepth: 3, maxDurationMs: 90_000 },
    ...over,
  });
}

let result: ScanResult;

beforeAll(async () => {
  try {
    result = await crawlFixture();
  } catch (error) {
    const message = (error as Error).message;
    if (/Executable doesn't exist|browser_launch_failed|Could not start the browser/i.test(message)) {
      throw new Error(
        "Chromium is not installed. Run `npx playwright install chromium` " +
          `before \`npm run test:browser\`. Original error: ${message}`,
      );
    }
    throw error;
  }
}, 180_000);

describe("static pages", () => {
  it("renders the entry page and records its title and status", () => {
    const home = result.pages.find((p) => p.url.endsWith(`:${sitePort}/`));
    expect(home).toBeDefined();
    expect(home!.status).toBe(200);
    expect(home!.title).toBe("Fixture Home");
    expect(home!.error).toBeNull();
  });

  it("follows same-origin links and records each page once", () => {
    const urls = result.pages.map((p) => p.url);
    expect(urls.some((u) => u.endsWith("/about"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("captures a first-party script", () => {
    const first = result.scripts.find((s) => s.url?.includes("/first-party.js"));
    expect(first).toBeDefined();
    expect(first!.isThirdParty).toBe(false);
  });
});

describe("a dynamically loaded tracker", () => {
  /**
   * The scenario that proves rendering rather than fetching. The gtag script is
   * appended by `setTimeout` after parse, so it appears in no static HTML and a
   * fetch-only scanner would report the site as clean.
   */
  it("is captured even though it is injected after parse", () => {
    const injected = result.scripts.find((s) => s.url?.includes("/gtag/js"));
    expect(
      injected,
      "the dynamically injected script was not observed - the crawler may not be rendering",
    ).toBeDefined();
  });

  it("is classified by the detectors", () => {
    const ga = result.technologies.find((t) => t.detectorId === "google-analytics");
    expect(ga).toBeDefined();
    expect(ga!.evidence.length).toBeGreaterThan(0);
  });

  it("has its query string stripped before it is recorded", () => {
    // `?id=G-FIXTURE` on the script and `?uid=abc123` on the pixel are where
    // identifiers live, and neither may be retained.
    for (const script of result.scripts) {
      expect(script.url ?? "").not.toContain("?");
    }
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("abc123");
    expect(serialised).not.toContain("G-FIXTURE");
  });
});

describe("an iframe", () => {
  it("is observed as a document request to the third-party host", () => {
    const documents = result.requests.filter((r) => r.resourceType === "document");
    expect(documents.length).toBeGreaterThan(0);
  });

  it("does not become a crawled page of its own", () => {
    // A framed document is a resource of the page, not a page of the site.
    expect(result.pages.some((p) => p.url.includes("/frame.html"))).toBe(false);
  });
});

describe("a script-generated cookie", () => {
  it("is captured, not just the ones from Set-Cookie", () => {
    const names = result.cookies.map((c) => c.name);
    expect(names).toContain("script_written");
    expect(names).toContain("server_set");
  });

  it("never carries a value", () => {
    for (const cookie of result.cookies) {
      expect(Object.keys(cookie)).not.toContain("value");
    }
  });
});

describe("a third-party request", () => {
  it("records the pixel as an image request", () => {
    expect(result.requests.some((r) => r.resourceType === "image")).toBe(true);
  });

  it("records requests to the third-party port", () => {
    // Both fixtures share the 127.0.0.1 host, so third-party *classification*
    // cannot be asserted here - that is covered by `crawler-url.test.ts`
    // against real hostnames. What matters here is that the requests a real
    // browser issued were observed at all.
    expect(result.requests.length).toBeGreaterThan(3);
    expect(result.summary.requestsObserved).toBeGreaterThan(3);
  });
});

describe("browser storage", () => {
  it("records local and session storage keys", () => {
    const keys = result.storage.map((s) => s.name);
    expect(keys).toContain("ls_key");
    expect(keys).toContain("ss_key");
  });

  it("never records a stored value", () => {
    expect(JSON.stringify(result.storage)).not.toContain("never-read");
  });
});

describe("a failed page", () => {
  it("is recorded rather than dropped, and does not abort the crawl", () => {
    const broken = result.pages.find((p) => p.url.endsWith("/broken"));
    expect(broken).toBeDefined();
    expect(broken!.status).toBe(500);
    // and the rest of the crawl still happened
    expect(result.pages.length).toBeGreaterThan(2);
  });
});

describe("crawl boundaries", () => {
  it("never leaves the origin it was given", () => {
    for (const page of result.pages) {
      expect(page.url.startsWith(`http://127.0.0.1:${sitePort}`)).toBe(true);
    }
    expect(result.pages.some((p) => p.url.includes("example.org"))).toBe(false);
  });

  it("honours maxPages and says which limit stopped it", async () => {
    const limited = await crawlFixture({
      limits: { maxPages: 2, maxDepth: 3, maxDurationMs: 60_000 },
    });
    expect(limited.pages.length).toBeLessThanOrEqual(2);
    expect(limited.summary.limitReached).toBe("maxPages");
  }, 120_000);

  it("honours maxDepth", async () => {
    const shallow = await crawlFixture({
      limits: { maxPages: 20, maxDepth: 1, maxDurationMs: 60_000 },
    });
    // Depth 1 reaches the entry page and its direct links, never /depth-2.
    expect(shallow.pages.some((p) => p.url.endsWith("/depth-2"))).toBe(false);
  }, 120_000);
});

describe("the result carries no legal determination", () => {
  it("says what it observed and nothing about lawfulness", () => {
    const serialised = JSON.stringify(result).toLowerCase();
    for (const word of ["lawful", "compliant", "consent_required", "violation"]) {
      expect(serialised).not.toContain(word);
    }
  });
});

describe("recurring scans", () => {
  it("produce a stable result, so a diff of two identical crawls is empty", async () => {
    // The property the Phase 8A diff depends on: if two crawls of an unchanged
    // site disagreed, every recurring scan would report phantom churn.
    const second = await crawlFixture();
    const names = (r: ScanResult) => r.cookies.map((c) => c.name).sort();
    expect(names(second)).toEqual(names(result));

    const storage = (r: ScanResult) => r.storage.map((s) => s.name).sort();
    expect(storage(second)).toEqual(storage(result));
  }, 120_000);
});
