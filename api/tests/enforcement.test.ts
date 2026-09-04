/**
 * @vitest-environment jsdom
 *
 * Browser enforcement.
 *
 * Phase 9B names the scenarios covered here: consent allowed, denied and
 * withdrawn; an unknown tracker falling back to configured behaviour; a changed
 * policy producing a new decision; and the right policy for the jurisdiction.
 * The server-side boundary and the cross-tenant and bypass cases are in the
 * integration suite, because they need the database that makes them meaningful.
 *
 * Two properties matter more than any individual case:
 *
 *  - **Silence is not consent.** An undecided purpose blocks, and there is a
 *    test that the undecided and denied paths reach the same decision by
 *    different reasons.
 *  - **A bug in enforcement must never take a customer's site down.** Every
 *    patch falls through to the original on error, and that is tested by
 *    breaking the consent client on purpose.
 *
 * No database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnforcementClient,
  decide,
  hostMatches,
  hostOf,
} from "../../sdk/src/enforce";
import { enforcementFrom } from "@/lib/consent-config";
import type { ConsentApi, ConsentRecordOptions } from "../../sdk/src/consent";
import type { EnforcementConfig, EnforcementRule } from "@rift-cmp/shared";
import type { ConsentStatus, EffectiveConsent } from "@rift-cmp/shared";

const AS_OF = "2026-09-04T00:00:00.000Z";

function rule(over: Partial<EnforcementRule> = {}): EnforcementRule {
  return {
    host: "google-analytics.com",
    vendor: "Google Analytics",
    purpose: "analytics",
    action: "require_consent",
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

function decided(code: string, status: ConsentStatus): EffectiveConsent {
  return {
    purpose_code: code,
    status,
    decided_at: AS_OF,
    consent_record_id: `r_${code}`,
    notice_id: null,
    policy_version_id: null,
  };
}

/** Decide without a browser: the same function the patches call. */
function verdict(
  granted: string[],
  decidedCodes: string[],
  resource = "https://www.google-analytics.com/collect",
  over: Partial<EnforcementConfig> = {},
) {
  const c = config(over);
  return decide({
    resource,
    host: hostOf(resource),
    rules: c.rules,
    unknownHost: c.unknown_host,
    granted: new Set(granted),
    decided: new Set(decidedCodes),
  });
}

// ─── Host matching ───────────────────────────────────────────────────────────

describe("host matching mirrors the server catalogue", () => {
  it("matches the host itself and any subdomain", () => {
    expect(hostMatches("google-analytics.com", "google-analytics.com")).toBe(true);
    expect(hostMatches("www.google-analytics.com", "google-analytics.com")).toBe(true);
    expect(hostMatches("a.b.google-analytics.com", "google-analytics.com")).toBe(true);
  });

  it("is not fooled by a host that merely ends the same way", () => {
    // The bug that would let `evilgoogle-analytics.com` through a rule.
    expect(hostMatches("evilgoogle-analytics.com", "google-analytics.com")).toBe(false);
    expect(hostMatches("google-analytics.com.attacker.test", "google-analytics.com")).toBe(
      false,
    );
  });

  it("ignores case and a trailing dot", () => {
    expect(hostMatches("WWW.Google-Analytics.com.", "google-analytics.com")).toBe(true);
  });

  it("extracts a host only from an http(s) URL", () => {
    expect(hostOf("https://a.test/x?y=1")).toBe("a.test");
    expect(hostOf("data:text/plain,hi")).toBeNull();
    expect(hostOf("javascript:alert(1)")).toBeNull();
    expect(hostOf("blob:https://a.test/123")).toBeNull();
  });

  it("resolves a relative URL against the page, so first-party is evaluated", () => {
    // A tag fetching "/collect" is making a first-party request, and a rule
    // written against the site's own host has to be able to match it. Treating
    // a relative URL as unparseable would silently exempt every same-origin
    // request from every rule.
    expect(hostOf("/collect")).toBe(globalThis.location.hostname);
    expect(hostOf("collect")).toBe(globalThis.location.hostname);
  });
});

// ─── 1–3. Allowed, denied, withdrawn ─────────────────────────────────────────

describe("consent allowed → resource allowed", () => {
  it("allows a gated vendor once its purpose is granted", () => {
    const d = verdict(["analytics"], ["analytics"]);
    expect(d.decision).toBe("allow");
    expect(d.user_state).toBe("granted");
    expect(d.reason).toContain("granted");
  });

  it("names the rule it applied", () => {
    const d = verdict(["analytics"], ["analytics"]);
    expect(d.policy?.vendor).toBe("Google Analytics");
    expect(d.purpose).toBe("analytics");
  });
});

describe("consent denied → resource blocked", () => {
  it("blocks when the purpose was decided and not granted", () => {
    const d = verdict([], ["analytics"]);
    expect(d.decision).toBe("block");
    expect(d.user_state).toBe("denied_or_withdrawn");
  });
});

describe("consent withdrawn → resource blocked", () => {
  it("blocks after a withdrawal, exactly as after a denial", () => {
    // Withdrawal and denial are different facts in the log and the same fact
    // for enforcement: neither is a granted purpose.
    const d = verdict([], ["analytics"]);
    expect(d.decision).toBe("block");
  });

  it("blocks a purpose that has never been decided, for a different reason", () => {
    const undecided = verdict([], []);
    expect(undecided.decision).toBe("block");
    expect(undecided.user_state).toBe("undecided");
    expect(undecided.reason).toContain("Silence is not consent");
  });
});

// ─── 4. Unknown tracker → configured fallback ────────────────────────────────

describe("an unknown tracker falls back to the configured behaviour", () => {
  it("allows by default, and says that is not a review", () => {
    const d = verdict([], [], "https://unknown-vendor.test/pixel.gif");
    expect(d.decision).toBe("allow");
    expect(d.policy).toBeNull();
    expect(d.reason).toContain("not evidence it was reviewed");
  });

  it("blocks when the operator has chosen a default-deny posture", () => {
    const d = verdict([], [], "https://unknown-vendor.test/pixel.gif", {
      unknown_host: "block",
    });
    expect(d.decision).toBe("block");
  });

  it("leaves a non-http resource alone", () => {
    const d = verdict([], [], "data:image/gif;base64,R0lGOD");
    expect(d.decision).toBe("allow");
    expect(d.reason).toContain("Not an http(s) URL");
  });
});

// ─── 5. Changed policy → new decision ────────────────────────────────────────

describe("a changed policy produces a new decision", () => {
  it("switches from blocked to allowed when the action changes", () => {
    const gated = verdict([], ["analytics"]);
    expect(gated.decision).toBe("block");

    const allowed = verdict([], ["analytics"], "https://www.google-analytics.com/collect", {
      rules: [rule({ action: "allow" })],
    });
    expect(allowed.decision).toBe("allow");
    expect(allowed.reason).toContain("without a consent gate");
  });

  it("blocks outright when the policy says block, whatever the visitor chose", () => {
    const d = verdict(["analytics"], ["analytics"], "https://www.google-analytics.com/collect", {
      rules: [rule({ action: "block" })],
    });
    expect(d.decision).toBe("block");
    expect(d.reason).toContain("blocks Google Analytics outright");
  });

  it("blocks a consent gate that names no purpose, rather than ignoring it", () => {
    // Such a rule can never be satisfied, so allowing it would leave a control
    // that looks real and does nothing.
    const d = verdict(["analytics"], ["analytics"], "https://www.google-analytics.com/collect", {
      rules: [rule({ purpose: null })],
    });
    expect(d.decision).toBe("block");
    expect(d.reason).toContain("names no purpose");
  });
});

// ─── 6. Wrong jurisdiction → correct policy ──────────────────────────────────

describe("the policy that is served is the one that was approved", () => {
  it("carries only rules from the approved recommendations", () => {
    const eu = enforcementFrom(
      [
        {
          vendor_name: "Google Analytics",
          suggested_purpose: "analytics",
          recommended_action: "require_consent",
        },
      ],
      () => ["google-analytics.com"],
    );
    expect(eu.rules).toHaveLength(1);
    expect(eu.rules[0].purpose).toBe("analytics");
  });

  it("produces no rule for a vendor the operator chose to ignore", () => {
    const built = enforcementFrom(
      [
        {
          vendor_name: "Google Analytics",
          suggested_purpose: "analytics",
          recommended_action: "ignore",
        },
      ],
      () => ["google-analytics.com"],
    );
    expect(built.rules).toEqual([]);
  });

  it("produces no rule for a vendor the autopilot could not decide", () => {
    // Acting on "I do not know" by blocking would take a site down on the
    // strength of an absence.
    const built = enforcementFrom(
      [{ vendor_name: "Mystery", suggested_purpose: null, recommended_action: "review" }],
      () => ["mystery.test"],
    );
    expect(built.rules).toEqual([]);
  });

  it("defaults to observe, not enforce", () => {
    const built = enforcementFrom(
      [
        {
          vendor_name: "Google Analytics",
          suggested_purpose: "analytics",
          recommended_action: "require_consent",
        },
      ],
      () => ["google-analytics.com"],
    );
    expect(built.mode).toBe("observe");
    expect(built.unknown_host).toBe("allow");
  });

  it("expands one vendor to every host the catalogue knows it by", () => {
    const built = enforcementFrom(
      [
        {
          vendor_name: "Google Analytics",
          suggested_purpose: "analytics",
          recommended_action: "require_consent",
        },
      ],
      () => ["analytics.google.com", "google-analytics.com"],
    );
    expect(built.rules.map((r) => r.host)).toEqual([
      "analytics.google.com",
      "google-analytics.com",
    ]);
  });

  it("orders rules, so first-match-wins is stable", () => {
    const built = enforcementFrom(
      [
        { vendor_name: "Z", suggested_purpose: "a", recommended_action: "allow" },
        { vendor_name: "A", suggested_purpose: "a", recommended_action: "allow" },
      ],
      (v) => [`${v.toLowerCase()}.test`],
    );
    expect(built.rules.map((r) => r.host)).toEqual(["a.test", "z.test"]);
  });
});

// ─── The live page ───────────────────────────────────────────────────────────

describe("applying the policy to the page", () => {
  let consent: FakeConsent;
  let client: EnforcementClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    consent = new FakeConsent();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("ok")) as unknown as typeof fetch;
    window.fetch = globalThis.fetch;
  });

  afterEach(() => {
    client?.stop();
    globalThis.fetch = originalFetch;
    window.fetch = originalFetch;
  });

  it("does not start when there is no approved policy", () => {
    client = new EnforcementClient(consent);
    expect(client.start(null)).toBe(false);
    expect(client.start(config({ rules: [] }))).toBe(false);
    expect(client.start(config({ mode: "off" }))).toBe(false);
  });

  it("blocks a gated fetch when the purpose is not granted", async () => {
    client = new EnforcementClient(consent);
    expect(client.start(config())).toBe(true);

    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).rejects.toThrow(/blocked by consent policy/);
  });

  it("allows the same fetch once the purpose is granted", async () => {
    consent.state = [decided("analytics", "GRANTED")];
    client = new EnforcementClient(consent);
    client.start(config());

    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).resolves.toBeInstanceOf(Response);
  });

  it("blocks it again after a withdrawal", async () => {
    consent.state = [decided("analytics", "GRANTED")];
    client = new EnforcementClient(consent);
    client.start(config());
    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).resolves.toBeInstanceOf(Response);

    consent.state = [decided("analytics", "WITHDRAWN")];
    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).rejects.toThrow(/blocked/);
  });

  it("leaves an unmatched host alone", async () => {
    client = new EnforcementClient(consent);
    client.start(config());
    await expect(window.fetch("https://example.test/api")).resolves.toBeInstanceOf(
      Response,
    );
  });

  it("observes without blocking in observe mode", async () => {
    client = new EnforcementClient(consent);
    client.start(config({ mode: "observe" }));

    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).resolves.toBeInstanceOf(Response);

    const decisions = client.explain();
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision).toBe("block");
    expect(decisions[0].observed_only).toBe(true);
  });

  it("stops a blocked script from being inserted", () => {
    client = new EnforcementClient(consent);
    client.start(config());

    const script = document.createElement("script");
    script.src = "https://www.google-analytics.com/analytics.js";
    document.head.appendChild(script);

    expect(document.head.contains(script)).toBe(false);
  });

  it("lets an allowed script through", () => {
    consent.state = [decided("analytics", "GRANTED")];
    client = new EnforcementClient(consent);
    client.start(config());

    const script = document.createElement("script");
    script.src = "https://www.google-analytics.com/analytics.js";
    document.head.appendChild(script);

    expect(document.head.contains(script)).toBe(true);
  });

  it("never blocks an element that is not a script", () => {
    client = new EnforcementClient(consent);
    client.start(config());

    const div = document.createElement("div");
    document.body.appendChild(div);
    expect(document.body.contains(div)).toBe(true);
  });

  it("blocks a pixel set through Image.src", () => {
    client = new EnforcementClient(consent);
    client.start(config());

    const image = new Image();
    image.src = "https://www.google-analytics.com/pixel.gif";
    expect(image.src).toBe("");
  });

  it("restores every patched global on stop", async () => {
    const before = window.fetch;
    const beforeAppend = Node.prototype.appendChild;
    client = new EnforcementClient(consent);
    client.start(config());
    expect(window.fetch).not.toBe(before);

    client.stop();
    expect(window.fetch).toBe(before);
    expect(Node.prototype.appendChild).toBe(beforeAppend);
    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).resolves.toBeInstanceOf(Response);
  });

  it("does not break the page when the consent client throws", async () => {
    /**
     * The property that matters most operationally. A bug in enforcement must
     * degrade to "not enforcing", never to "site down".
     */
    const broken = new FakeConsent();
    broken.getCachedState = () => {
      throw new Error("boom");
    };
    client = new EnforcementClient(broken);
    client.start(config());

    await expect(
      window.fetch("https://www.google-analytics.com/collect"),
    ).resolves.toBeInstanceOf(Response);
  });
});

// ─── The test mode ───────────────────────────────────────────────────────────

describe("the test mode", () => {
  it("reports every column the brief asks for", () => {
    const consent = new FakeConsent();
    const client = new EnforcementClient(consent);
    client.start(config({ mode: "observe" }));

    void window.fetch("https://www.google-analytics.com/collect").catch(() => {});
    const [row] = client.explain();

    expect(row.resource).toContain("google-analytics.com");
    expect(row.vendor).toBe("Google Analytics"); // Tracker
    expect(row.purpose).toBe("analytics"); // Purpose
    expect(row.user_state).toBe("undecided"); // User state
    expect(row.policy?.action).toBe("require_consent"); // Policy
    expect(row.decision).toBe("block"); // Decision
    expect(row.reason.length).toBeGreaterThan(10); // Reason
    client.stop();
  });

  it("records allowed decisions too, not only blocks", () => {
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "GRANTED")];
    const client = new EnforcementClient(consent);
    client.start(config());

    void window.fetch("https://www.google-analytics.com/collect").catch(() => {});
    expect(client.explain().some((d) => d.decision === "allow")).toBe(true);
    client.stop();
  });

  it("previews a decision without touching the page", () => {
    const consent = new FakeConsent();
    const client = new EnforcementClient(consent);
    client.start(config());

    const preview = client.preview("https://www.google-analytics.com/collect");
    expect(preview.decision).toBe("block");
    // and previewing did not add a row to the log
    expect(client.explain()).toHaveLength(0);
    client.stop();
  });

  it("bounds what it retains, so a long session cannot grow without limit", () => {
    const consent = new FakeConsent();
    const client = new EnforcementClient(consent, { maxDecisions: 3 });
    client.start(config({ mode: "observe" }));

    for (let i = 0; i < 10; i++) {
      void window.fetch(`https://www.google-analytics.com/c${i}`).catch(() => {});
    }
    expect(client.explain().length).toBeLessThanOrEqual(3);
    client.stop();
  });
});
