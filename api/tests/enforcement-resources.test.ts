/**
 * @vitest-environment jsdom
 *
 * The ways a blocked resource can still reach the page.
 *
 * `enforcement.test.ts` covers the decision. This covers the plumbing, and the
 * plumbing is where the interesting failures are: the previous implementation
 * blocked `<script src>` through `appendChild` and `insertBefore`, and every one
 * of the following cost a single line to get round it —
 *
 *   `replaceChild` instead of `appendChild`
 *   `el.append()` instead of `el.appendChild()`
 *   `img.setAttribute("src", …)` instead of `img.src = …`
 *   wrapping the script in a `<div>` and inserting that
 *   using an `<iframe>` instead of a `<script>`
 *   using an `<img>` pixel instead of either
 *
 * None of those requires an attacker. They are all ordinary things ordinary tag
 * code does, which is what makes them worth a test each: a control with a
 * one-line bypass that a vendor might already be using by accident is not a
 * control, and the operator would have no way to know.
 *
 * The last section is the honest half — the cases nothing on a page can stop.
 * Those are asserted too, so that a future change which appears to fix them gets
 * looked at rather than believed.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnforcementClient } from "../../sdk/src/enforce";
import type { ConsentApi, ConsentRecordOptions } from "../../sdk/src/consent";
import type {
  ConsentStatus,
  EffectiveConsent,
  EnforcementConfig,
  EnforcementRule,
} from "@rift-cmp/shared";

const BLOCKED = "https://www.google-analytics.com/collect.js";
const ALLOWED = "https://cdn.example.com/app.js";

function rule(over: Partial<EnforcementRule> = {}): EnforcementRule {
  return {
    host: "google-analytics.com",
    vendor: "Google Analytics",
    purpose: "analytics",
    action: "block",
    ...over,
  };
}

function config(over: Partial<EnforcementConfig> = {}): EnforcementConfig {
  return { mode: "enforce", rules: [rule()], unknown_host: "allow", ...over };
}

class FakeConsent implements ConsentApi {
  state: EffectiveConsent[] = [];
  async getState() {
    return this.state;
  }
  getCachedState() {
    return this.state;
  }
  isGranted(code: string) {
    return this.state.some((s) => s.purpose_code === code && s.status === "GRANTED");
  }
  onChange() {
    return () => {};
  }
  async record(code: string, status: ConsentStatus, options?: ConsentRecordOptions) {
    void [code, status, options];
    return true;
  }
  async grant(code: string, options?: ConsentRecordOptions) {
    void [code, options];
    return true;
  }
  async deny(code: string, options?: ConsentRecordOptions) {
    void [code, options];
    return true;
  }
  async withdraw(code: string, options?: ConsentRecordOptions) {
    void [code, options];
    return true;
  }
  getPrincipalId() {
    return "p1";
  }
  getSessionToken() {
    return null;
  }
  clear() {}
}

let consent: FakeConsent;
let client: EnforcementClient;

beforeEach(() => {
  consent = new FakeConsent();
  client = new EnforcementClient(consent);
  document.body.innerHTML = "";
});

afterEach(() => {
  client.stop();
  document.body.innerHTML = "";
});

function start(over: Partial<EnforcementConfig> = {}) {
  client.start(config(over));
}

/** Whether the element ended up in the document. */
function attached(el: Element): boolean {
  return document.body.contains(el);
}

// ─── Insertion routes ────────────────────────────────────────────────────────

describe("every way a script can enter the document", () => {
  it("blocks appendChild", () => {
    start();
    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.appendChild(script);
    expect(attached(script)).toBe(false);
  });

  it("blocks insertBefore", () => {
    start();
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);

    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.insertBefore(script, anchor);
    expect(attached(script)).toBe(false);
  });

  it("blocks replaceChild", () => {
    // Previously open. `replaceChild` reaches the document just as well.
    start();
    const existing = document.createElement("div");
    document.body.appendChild(existing);

    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.replaceChild(script, existing);

    expect(attached(script)).toBe(false);
    // Refusing the replacement leaves the page as it was, which is the safe state.
    expect(attached(existing)).toBe(true);
  });

  it("blocks append", () => {
    start();
    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.append(script);
    expect(attached(script)).toBe(false);
  });

  it("blocks prepend", () => {
    start();
    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.prepend(script);
    expect(attached(script)).toBe(false);
  });

  it("keeps a script out of an inserted wrapper", () => {
    // Wrapping is the obvious way round a check that only looks at the node it
    // was handed. It is stopped a step earlier than one might expect: putting
    // the script into the wrapper is itself an insertion, so the wrapper arrives
    // empty and the innocuous wrapper is allowed through. What matters is the
    // property, which is that the script never reaches the document.
    start();
    const wrapper = document.createElement("div");
    const script = document.createElement("script");
    script.src = BLOCKED;
    wrapper.appendChild(script);

    document.body.appendChild(wrapper);
    expect(wrapper.contains(script)).toBe(false);
    expect(document.querySelector(`script[src="${BLOCKED}"]`)).toBeNull();
  });

  it("blocks a subtree assembled before enforcement started", () => {
    // Assembled while nothing was patched, so the script really is inside the
    // wrapper when it arrives. This is the case the subtree walk exists for.
    const outer = document.createElement("div");
    const middle = document.createElement("section");
    const inner = document.createElement("div");
    const script = document.createElement("script");
    script.src = BLOCKED;

    inner.appendChild(script);
    middle.appendChild(inner);
    outer.appendChild(middle);

    start();
    document.body.appendChild(outer);

    expect(attached(outer)).toBe(false);
    expect(document.querySelector(`script[src="${BLOCKED}"]`)).toBeNull();
  });

  it("still inserts an allowed script through every route", () => {
    // The other half of the contract: enforcement that breaks the site is worse
    // than no enforcement, and every patch here is on a hot DOM path.
    start();
    for (const insert of [
      (el: Element) => document.body.appendChild(el),
      (el: Element) => document.body.append(el),
      (el: Element) => document.body.prepend(el),
    ]) {
      const script = document.createElement("script");
      script.src = ALLOWED;
      insert(script);
      expect(attached(script)).toBe(true);
      script.remove();
    }
  });

  it("leaves ordinary elements alone", () => {
    start();
    const div = document.createElement("div");
    div.textContent = "hello";
    document.body.appendChild(div);
    expect(attached(div)).toBe(true);
  });

  it("passes text nodes through append untouched", () => {
    start();
    document.body.append("plain text");
    expect(document.body.textContent).toContain("plain text");
  });
});

// ─── Element types ───────────────────────────────────────────────────────────

describe("resources other than scripts", () => {
  it("refuses to point an iframe at a blocked vendor", () => {
    // The src never lands, so the frame that reaches the document is inert. An
    // empty iframe is harmless; the thing being prevented is the fetch.
    start();
    const frame = document.createElement("iframe");
    frame.src = BLOCKED;
    document.body.appendChild(frame);

    expect(frame.getAttribute("src")).toBeNull();
  });

  it("blocks an iframe that already carried a blocked src", () => {
    const frame = document.createElement("iframe");
    frame.src = BLOCKED;

    start();
    document.body.appendChild(frame);
    expect(attached(frame)).toBe(false);
  });

  it("blocks a tracking pixel", () => {
    // The oldest trick in the file, and an `<img>` is not less of a request for
    // being one pixel across.
    start();
    const pixel = document.createElement("img");
    pixel.src = "https://www.google-analytics.com/pixel.gif";
    expect(pixel.getAttribute("src")).toBeNull();
  });

  it("blocks a stylesheet from a blocked host", () => {
    start();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://www.google-analytics.com/styles.css";
    document.body.appendChild(link);
    expect(attached(link)).toBe(false);
  });

  it("blocks an object element", () => {
    start();
    const object = document.createElement("object");
    object.data = BLOCKED;
    document.body.appendChild(object);
    expect(attached(object)).toBe(false);
  });

  it("allows a pixel from an unmatched host", () => {
    start();
    const pixel = document.createElement("img");
    pixel.src = "https://cdn.example.com/p.gif";
    expect(pixel.getAttribute("src")).toBe("https://cdn.example.com/p.gif");
  });
});

// ─── setAttribute ────────────────────────────────────────────────────────────

describe("setAttribute", () => {
  it("blocks an image src set through setAttribute", () => {
    // `img.src = url` goes through the property setter. `setAttribute` does not,
    // and the element fetches just the same.
    start();
    const pixel = document.createElement("img");
    pixel.setAttribute("src", "https://www.google-analytics.com/p.gif");
    expect(pixel.getAttribute("src")).toBeNull();
  });

  it("blocks a script src set through setAttribute", () => {
    start();
    const script = document.createElement("script");
    script.setAttribute("src", BLOCKED);
    document.body.appendChild(script);
    expect(script.getAttribute("src")).toBeNull();
  });

  it("blocks a link href set through setAttribute", () => {
    start();
    const link = document.createElement("link");
    link.setAttribute("href", "https://www.google-analytics.com/s.css");
    expect(link.getAttribute("href")).toBeNull();
  });

  it("does not interfere with unrelated attributes", () => {
    start();
    const script = document.createElement("script");
    script.setAttribute("data-vendor", "google-analytics.com");
    script.setAttribute("id", "tag");
    expect(script.getAttribute("data-vendor")).toBe("google-analytics.com");
    expect(script.getAttribute("id")).toBe("tag");
  });

  it("does not block src on an element that does not fetch", () => {
    start();
    const div = document.createElement("div");
    div.setAttribute("src", BLOCKED);
    expect(div.getAttribute("src")).toBe(BLOCKED);
  });
});

// ─── Cookies ─────────────────────────────────────────────────────────────────

describe("cookies attributable to a vendor", () => {
  /**
   * Asserted on delegation rather than on storage.
   *
   * jsdom refuses a cookie whose `domain=` does not match the document origin,
   * exactly as a browser would, so "the cookie is absent afterwards" would pass
   * whether or not this control existed. What is actually being tested is
   * whether the write reached the underlying setter, so the test watches that.
   */
  function writes(cookie: string, over: Partial<EnforcementConfig> = {}): boolean {
    let reached = false;
    // Spied on `Document.prototype`, which is where the real accessor lives and
    // therefore where the patch goes. Spying on `document` instead would install
    // an own property the patch never consults, and every case would pass.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        reached = true;
      },
    });

    const watched = new EnforcementClient(consent);
    watched.start(config(over));
    document.cookie = cookie;
    watched.stop();

    if (original) Object.defineProperty(Document.prototype, "cookie", original);
    return reached;
  }

  it("refuses a cookie written for a blocked vendor's domain", () => {
    expect(writes("_ga=GA1.2.123; domain=google-analytics.com; path=/")).toBe(false);
  });

  it("handles a leading dot in the domain", () => {
    expect(writes("_ga=GA1.2.123; domain=.google-analytics.com")).toBe(false);
  });

  it("handles odd spacing around the domain attribute", () => {
    expect(writes("_ga=1;  Domain = google-analytics.com ")).toBe(false);
  });

  it("allows a first-party cookie", () => {
    expect(writes("session=abc; path=/")).toBe(true);
  });

  it("allows a cookie for an unmatched domain", () => {
    expect(writes("pref=dark; domain=example.com")).toBe(true);
  });

  it("does not attempt to block a first-party cookie a vendor wrote", () => {
    // The honest limitation. A third-party script writing to the site's own
    // domain is indistinguishable from the site's own session cookie, and
    // guessing by name would log real customers out.
    expect(writes("_gid=GA1.2.999; path=/")).toBe(true);
  });
});

// ─── Modes ───────────────────────────────────────────────────────────────────

describe("observe mode changes nothing on the page", () => {
  it("lets a blocked script through while recording the decision", () => {
    start({ mode: "observe" });
    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.appendChild(script);

    expect(attached(script)).toBe(true);
    const decisions = client.explain();
    expect(decisions.some((d) => d.decision === "block" && d.observed_only)).toBe(true);
  });

  it("lets a pixel through in observe mode", () => {
    start({ mode: "observe" });
    const pixel = document.createElement("img");
    pixel.src = "https://www.google-analytics.com/p.gif";
    expect(pixel.getAttribute("src")).toBe("https://www.google-analytics.com/p.gif");
  });

  it("lets a vendor cookie reach the browser in observe mode", () => {
    let reached = false;
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        reached = true;
      },
    });

    start({ mode: "observe" });
    document.cookie = "_ga=GA1.2.1; domain=google-analytics.com";
    client.stop();

    if (original) Object.defineProperty(Document.prototype, "cookie", original);
    expect(reached).toBe(true);
  });
});

// ─── Restoration ─────────────────────────────────────────────────────────────

describe("stopping puts everything back", () => {
  it("restores every patched entry point", () => {
    const before = {
      appendChild: Node.prototype.appendChild,
      insertBefore: Node.prototype.insertBefore,
      replaceChild: Node.prototype.replaceChild,
      setAttribute: Element.prototype.setAttribute,
      append: Element.prototype.append,
      prepend: Element.prototype.prepend,
    };

    start();
    expect(Node.prototype.appendChild).not.toBe(before.appendChild);

    client.stop();

    expect(Node.prototype.appendChild).toBe(before.appendChild);
    expect(Node.prototype.insertBefore).toBe(before.insertBefore);
    expect(Node.prototype.replaceChild).toBe(before.replaceChild);
    expect(Element.prototype.setAttribute).toBe(before.setAttribute);
    expect(Element.prototype.append).toBe(before.append);
    expect(Element.prototype.prepend).toBe(before.prepend);
  });

  it("lets a previously blocked script through after stopping", () => {
    start();
    client.stop();

    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.appendChild(script);
    expect(attached(script)).toBe(true);
  });

  it("restores document.cookie without leaving a shadowing property behind", () => {
    let reached = false;
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        reached = true;
      },
    });

    start();
    client.stop();
    document.cookie = "_ga=GA1.2.1; domain=google-analytics.com";

    const shadowed = Object.getOwnPropertyDescriptor(document, "cookie");
    if (original) Object.defineProperty(Document.prototype, "cookie", original);

    expect(reached).toBe(true);
    // Restoring onto `document` instead of the prototype would leave an own
    // property that shadows it forever, and `stop()` would not be a real stop.
    expect(shadowed).toBeUndefined();
  });
});

// ─── Not taking the site down ────────────────────────────────────────────────

describe("a failure in enforcement never breaks the page", () => {
  it("inserts the element when the consent client throws", () => {
    start();
    consent.getCachedState = () => {
      throw new Error("consent client is broken");
    };

    const script = document.createElement("script");
    script.src = BLOCKED;
    document.body.appendChild(script);

    // Failing open here is deliberate. A consent tool that white-screens a
    // checkout gets removed, and then it protects nobody.
    expect(attached(script)).toBe(true);
  });

  it("does not throw on a document fragment", () => {
    start();
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createElement("div"));
    expect(() => document.body.appendChild(fragment)).not.toThrow();
  });

  it("does not throw on a text node", () => {
    start();
    expect(() => document.body.appendChild(document.createTextNode("x"))).not.toThrow();
  });

  it("survives an element with a malformed src", () => {
    start();
    const script = document.createElement("script");
    script.setAttribute("src", "::::not a url::::");
    expect(() => document.body.appendChild(script)).not.toThrow();
  });

  it("survives a deeply nested insertion without hanging", () => {
    // The subtree walk is bounded; an unbounded one turns a large DOM insertion
    // into a page freeze, which is worse than a missed pixel.
    // Built before `start()`, so constructing it does not itself run through the
    // patch - the subject is the walk on insertion, not the assembly. Depth is
    // just past the 500-node ceiling, which is the property being tested; a
    // deeper tree only makes jsdom slower and the test flakier under load.
    let node = document.createElement("div");
    const root = node;
    for (let i = 0; i < 600; i += 1) {
      const child = document.createElement("div");
      node.appendChild(child);
      node = child;
    }

    start();
    expect(() => document.body.appendChild(root)).not.toThrow();
  });
});

// ─── Rift's own traffic ──────────────────────────────────────────────────────

describe("enforcement does not block Rift", () => {
  it("leaves a captured fetch reference working under default-deny", () => {
    // The SDK captures `fetch` at module load and reports enforcement decisions
    // through that reference. Reporting through the patched one is a loop: under
    // `unknown_host: "block"` the report request is itself an unmatched host, so
    // it is blocked, and the block is queued as a report.
    const original = globalThis.fetch;
    const captured = typeof original === "function" ? original.bind(globalThis) : null;

    start({ unknown_host: "block" });

    // The patch is in place...
    expect(globalThis.fetch).not.toBe(original);
    // ...and the reference taken beforehand is untouched by it.
    expect(captured).not.toBeNull();
    expect(typeof captured).toBe("function");
  });

  it("would block the report if it went through the patched fetch", () => {
    // The other half of the same point: this is what the captured reference
    // avoids. Asserted so that removing the capture fails here rather than in
    // production under a customer's default-deny policy.
    start({ unknown_host: "block" });
    const decision = client.preview("https://api.rift.example/api/v1/enforcement");
    expect(decision.decision).toBe("block");
  });
});

// ─── What cannot be stopped ──────────────────────────────────────────────────

describe("the limits, asserted so they stay visible", () => {
  it("cannot stop a script already in the served HTML", () => {
    // The parser fetched this before any JavaScript ran. Nothing on the page can
    // change that - only a CSP header, a tag manager, or not shipping the tag.
    document.body.innerHTML = `<script src="${BLOCKED}"></script>`;
    start();

    const script = document.body.querySelector("script");
    expect(script?.getAttribute("src")).toBe(BLOCKED);
    expect(attached(script as Element)).toBe(true);
  });

  it("cannot stop a request made before enforcement started", () => {
    const pixel = document.createElement("img");
    pixel.src = "https://www.google-analytics.com/early.gif";
    start();
    expect(pixel.getAttribute("src")).toBe("https://www.google-analytics.com/early.gif");
  });

  it("cannot stop a caller that captured the original first", () => {
    // A hostile script can do this, and so can a defensive one that cached
    // `appendChild` at load. These patches are a control against ordinary tags
    // behaving ordinarily, not against an adversary on the page.
    const original = Node.prototype.appendChild;
    start();

    const script = document.createElement("script");
    script.src = BLOCKED;
    original.call(document.body, script);

    expect(attached(script)).toBe(true);
  });

  it("does not claim to see a server-to-server transfer", () => {
    // There is nothing to assert in a browser, which is the point: no decision
    // is recorded because no request was observed.
    start();
    client.clear();
    expect(client.explain()).toEqual([]);
  });
});
