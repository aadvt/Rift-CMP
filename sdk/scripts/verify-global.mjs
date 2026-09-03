/**
 * Verifies the browser global exposed by the production bundle.
 *
 * This exists because the bundle once shipped with `--global-name analytics`
 * while `src/index.ts` also assigned `window.analytics`. The bundler emits
 * `var analytics = (() => { … })()`, and under classic `<script>` semantics a
 * top-level `var` becomes a property of the global object *after* the module
 * body has run — so the bundler's module namespace overwrote the callable SDK
 * and `analytics.init` was undefined. The install snippet the dashboard gives
 * operators was broken by it, and nothing caught it, because the demo page
 * happened to work around it with `window.analytics?.analytics ?? window.analytics`.
 *
 * `eval()` cannot reproduce this: the bundle starts with `"use strict"`, and in
 * a strict eval a top-level `var` is scoped to the eval rather than published on
 * the global object — which makes the bug disappear and the test lie. `vm.Script`
 * run in a context is the faithful model, so that is what is used here.
 *
 * Run: node sdk/scripts/verify-global.mjs
 * Exits non-zero on failure, so it can gate a build.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(here, "../dist/index.global.js");

if (!fs.existsSync(bundlePath)) {
  console.error(`No bundle at ${bundlePath}. Run \`npm -w sdk run build\` first.`);
  process.exit(1);
}

/** A browser-ish global object: just enough for the SDK's module body to run. */
function makeSandbox() {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const sandbox = {
    console,
    document: {
      title: "Test",
      referrer: "",
      addEventListener() {},
      removeEventListener() {},
      visibilityState: "visible",
    },
    navigator: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      sendBeacon: () => true,
    },
    location: { href: "https://example.com/pricing" },
    sessionStorage: storage,
    localStorage: storage,
    crypto: globalThis.crypto,
    fetch: async () => ({ ok: true, status: 202, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

const failures = [];
const check = (label, condition, detail = "") => {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
};

const source = fs.readFileSync(bundlePath, "utf8");
const sandbox = makeSandbox();
vm.createContext(sandbox);

// Exactly what a `<script src="rift-cmp.js">` does.
new vm.Script(source, { filename: "index.global.js" }).runInContext(sandbox);

console.log("Browser global, under classic <script> semantics\n");

check(
  "the bundle's own global name does not collide with `analytics`",
  !source.startsWith('"use strict";var analytics='),
  "bundler --global-name must not be `analytics`",
);

check("window.analytics is defined", typeof sandbox.window.analytics === "object");

check(
  "window.analytics is the callable SDK, not the module namespace",
  typeof sandbox.window.analytics?.init === "function",
  `keys: ${Object.keys(sandbox.window.analytics ?? {}).join(", ")}`,
);

for (const method of ["init", "track", "setConsentCheck"]) {
  check(`window.analytics.${method}() is a function`, typeof sandbox.window.analytics?.[method] === "function");
}
for (const member of ["consent", "discovery"]) {
  check(`window.analytics.${member} is present`, sandbox.window.analytics?.[member] != null);
}

// The bare identifier is what the dashboard's install snippet actually writes.
check(
  "the bare identifier `analytics` resolves to the same object",
  vm.runInContext("analytics === window.analytics", sandbox),
);

// The dashboard install snippet, copied verbatim in shape.
let snippetError = null;
try {
  vm.runInContext(
    `analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
     analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://example.com" });`,
    sandbox,
  );
} catch (error) {
  snippetError = error;
}
check("the dashboard install snippet runs", snippetError === null, snippetError?.message);

// Wrapped so a regression reports every failed check rather than crashing on
// the first one — the whole list is what tells you what broke.
let initResult = null;
try {
  initResult = vm.runInContext(
    `analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://example.com" })`,
    sandbox,
  );
} catch (error) {
  initResult = { error: error.message };
}
check(
  "init() returns the initialised state with a session id",
  initResult && initResult.siteId === "site_demo" && typeof initResult.sessionId === "string",
  JSON.stringify(initResult),
);

// The snippet above installed a consent gate, and nothing has been granted, so
// `track()` correctly refuses. Both halves are worth asserting: that the gate
// actually gates, and that an ungated call is queued.
// `track()` returns a Promise once the event reaches the client, and a bare
// `false` when it is refused before that (consent gate, or local bounds). Both
// shapes are pre-existing and documented; `await` covers them uniformly.
/** Runs a snippet against the bundle, resolving whatever `track()` returned. */
const run = async (code) => {
  try {
    return await Promise.resolve(vm.runInContext(code, sandbox));
  } catch (error) {
    return { error: error.message };
  }
};

// The snippet above installed a consent gate and nothing has been granted, so
// `track()` correctly refuses. Both halves matter: that the gate gates, and that
// an ungated call is queued.
const denied = await run(`analytics.track("signup", { plan: "pro" })`);
check("track() returns false while the consent gate denies", denied === false);

const accepted = await run(
  `analytics.setConsentCheck(() => true); analytics.track("signup", { plan: "pro" })`,
);
check("track() resolves true once the gate allows", accepted === true);

// Local EVENT_LIMITS pre-validation, through the real bundle.
const overLongName = await run(`analytics.track("n".repeat(500))`);
check("track() refuses an over-long event name locally", overLongName === false);

const oversizedProps = await run(`analytics.track("purchase", { blob: "x".repeat(20000) })`);
check("track() refuses oversized properties locally", oversizedProps === false);

const unserialisable = await run(`analytics.track("purchase", { big: BigInt(1) })`);
check("track() refuses unserialisable properties locally", unserialisable === false);

const stillWorks = await run(`analytics.track("purchase", { value: 499 })`);
check("a valid event is still accepted after refusals", stillWorks === true);

// demo.html reads `window.analytics?.analytics ?? window.analytics`; that
// fallback must still land on the callable object now that `.analytics` is gone.
check(
  "the demo page's access pattern still resolves",
  typeof vm.runInContext(
    "(window.analytics?.analytics ?? window.analytics).init",
    sandbox,
  ) === "function",
);

console.log();
if (failures.length) {
  console.log(`FAILED — ${failures.length} check(s)`);
  process.exit(1);
}
console.log("OK — the production bundle exposes the callable SDK as `window.analytics`.");
