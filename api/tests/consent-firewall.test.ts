/**
 * The firewall, and the one outcome that must never be silent.
 *
 * The decision core is the same function the browser has always run, and
 * `enforcement.test.ts` already covers it thoroughly. What is new here is the
 * layer on top: five classifications where there used to be two, and the
 * separation of *what was decided* from *what actually happened to the request*.
 *
 * The failure this file exists to prevent is an unmatched host being reported as
 * an `ALLOW`. Under the default policy it is allowed — that is deliberate, and
 * changing it would take down fonts, payment providers and the customer's own
 * API — but an allow that nobody reviewed and an allow that somebody approved
 * are different facts, and a screen that shows them identically tells an
 * operator their site is covered when it is not.
 */
import { describe, expect, it } from "vitest";
import type { EnforcementConfig, EnforcementRule } from "@rift-cmp/shared";
import { evaluateFirewall, type FirewallContext, type FirewallSubject } from "@rift-cmp/shared";

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

function subject(over: Partial<FirewallSubject> = {}): FirewallSubject {
  return {
    organisationId: "org-1",
    siteId: "site-1",
    destination: "https://www.google-analytics.com/collect",
    source: "server",
    ...over,
  };
}

function context(over: Partial<FirewallContext> = {}): FirewallContext {
  return {
    config: config(),
    granted: new Set<string>(),
    decided: new Set<string>(),
    policyVersion: "v3",
    ...over,
  };
}

// ─── The five outcomes ───────────────────────────────────────────────────────

describe("classifying a request", () => {
  it("allows a vendor the policy allows outright", () => {
    const result = evaluateFirewall(
      subject(),
      context({ config: config({ rules: [rule({ action: "allow" })] }) }),
    );

    expect(result.decision).toBe("ALLOW");
    expect(result.effect).toBe("allow");
    expect(result.severity).toBe("info");
  });

  it("blocks a vendor the policy blocks", () => {
    const result = evaluateFirewall(
      subject(),
      context({ config: config({ rules: [rule({ action: "block" })] }) }),
    );

    expect(result.decision).toBe("BLOCK");
    expect(result.effect).toBe("block");
    expect(result.severity).toBe("high");
  });

  it("reports a gated vendor with no decision as REQUIRE_CONSENT", () => {
    const result = evaluateFirewall(subject(), context());

    expect(result.decision).toBe("REQUIRE_CONSENT");
    // The gate exists and is unsatisfied, so the request does not go.
    expect(result.effect).toBe("block");
    expect(result.reason).toMatch(/silence is not consent/i);
  });

  it("allows a gated vendor once the purpose is granted", () => {
    const result = evaluateFirewall(
      subject(),
      context({ granted: new Set(["analytics"]), decided: new Set(["analytics"]) }),
    );

    expect(result.decision).toBe("ALLOW");
    expect(result.effect).toBe("allow");
    expect(result.userState).toBe("granted");
  });

  it("treats a refusal as more serious than silence", () => {
    // Somebody who said no is a stronger signal than somebody who has not been
    // asked, and an operator triaging findings should see that difference.
    const refused = evaluateFirewall(
      subject(),
      context({ decided: new Set(["analytics"]) }),
    );
    const silent = evaluateFirewall(subject(), context());

    expect(refused.severity).toBe("high");
    expect(silent.severity).toBe("medium");
  });

  it("classifies an allowed request with redactions as REDACT", () => {
    const result = evaluateFirewall(
      subject(),
      context({
        config: config({ rules: [rule({ action: "allow" })] }),
        redactions: ["email"],
      }),
    );

    expect(result.decision).toBe("REDACT");
    expect(result.effect).toBe("allow");
    expect(result.redactions).toEqual(["email"]);
  });
});

// ─── The unmatched host ──────────────────────────────────────────────────────

describe("a host no rule matches", () => {
  it("is REVIEW, never ALLOW", () => {
    const result = evaluateFirewall(
      subject({ destination: "https://unheard-of.example/pixel.gif" }),
      context(),
    );

    expect(result.decision).toBe("REVIEW");
    expect(result.matchedRule).toBeNull();
  });

  it("still lets the request through, because that is what the policy says", () => {
    // Being honest about the gap must not change what the site does. Blocking
    // every unrecognised host is available, and it is the operator's call.
    const result = evaluateFirewall(
      subject({ destination: "https://unheard-of.example/pixel.gif" }),
      context(),
    );

    expect(result.effect).toBe("allow");
    expect(result.reason).toMatch(/not evidence it was reviewed/i);
  });

  it("blocks it when the operator has chosen a default-deny posture", () => {
    const result = evaluateFirewall(
      subject({ destination: "https://unheard-of.example/pixel.gif" }),
      context({ config: config({ unknown_host: "block" }) }),
    );

    expect(result.decision).toBe("BLOCK");
    expect(result.effect).toBe("block");
  });

  it("is a task rather than a fault", () => {
    // A queue where every row is critical is a queue people stop reading.
    const result = evaluateFirewall(
      subject({ destination: "https://unheard-of.example/p.gif" }),
      context(),
    );
    expect(result.severity).toBe("low");
  });
});

// ─── Fail-safe ───────────────────────────────────────────────────────────────

describe("failing safe", () => {
  it("does not wave a consent gate through when no principal can be read", () => {
    // A server path with no visitor is not a visitor who agreed. The gate cannot
    // be evaluated, and an unevaluable gate is treated as unsatisfied.
    const result = evaluateFirewall(
      subject(),
      context({ granted: new Set(["analytics"]), principalKnown: false }),
    );

    expect(result.decision).toBe("REQUIRE_CONSENT");
    expect(result.effect).toBe("block");
    expect(result.reason).toMatch(/no principal/i);
  });

  it("blocks a consent gate that names no purpose", () => {
    // No decision could ever satisfy it, so allowing it would make the rule
    // decorative while looking like a control.
    const result = evaluateFirewall(
      subject(),
      context({ config: config({ rules: [rule({ purpose: null })] }) }),
    );

    expect(result.decision).toBe("REQUIRE_CONSENT");
    expect(result.effect).toBe("block");
  });

  it("does not invent a rule for an unparseable destination", () => {
    const result = evaluateFirewall(subject({ destination: "not a url at all" }), context());
    expect(result.host).toBeNull();
    expect(result.decision).toBe("ALLOW");
    expect(result.severity).toBe("info");
  });

  it("leaves a non-http scheme alone rather than queueing it forever", () => {
    const result = evaluateFirewall(
      subject({ destination: "data:image/gif;base64,R0lGOD" }),
      context(),
    );
    expect(result.decision).toBe("ALLOW");
    expect(result.reason).toMatch(/not an http/i);
  });

  it("copes with an empty rule set", () => {
    const result = evaluateFirewall(subject(), context({ config: config({ rules: [] }) }));
    expect(result.decision).toBe("REVIEW");
  });
});

// ─── Observation ─────────────────────────────────────────────────────────────

describe("observe mode", () => {
  it("marks a decision as observed rather than applied", () => {
    const result = evaluateFirewall(subject(), context({ config: config({ mode: "observe" }) }));

    expect(result.decision).toBe("REQUIRE_CONSENT");
    // The classification is unchanged; what changed is whether it happened.
    expect(result.observedOnly).toBe(true);
  });

  it("does not mark an enforcing decision as observed", () => {
    expect(evaluateFirewall(subject(), context()).observedOnly).toBe(false);
  });
});

// ─── Evidence ────────────────────────────────────────────────────────────────

describe("what a decision carries", () => {
  it("names the rule that matched, verbatim", () => {
    const result = evaluateFirewall(subject(), context());
    expect(result.matchedRule).toEqual(rule());
  });

  it("names the configuration it was judged against", () => {
    const result = evaluateFirewall(subject(), context());
    expect(result.policyVersion).toBe("v3");
    expect(result.evidence.some((e) => /approved configuration v3/.test(e.detail))).toBe(true);
  });

  it("says when there is no approved configuration at all", () => {
    const result = evaluateFirewall(subject(), context({ policyVersion: null }));
    expect(result.evidence.some((e) => /not an approved set/i.test(e.detail))).toBe(true);
  });

  it("keeps the plane the decision was taken on", () => {
    // Client and server enforcement are not equivalent controls and an audit
    // trail that merged them would overstate the browser one.
    expect(evaluateFirewall(subject({ source: "client" }), context()).source).toBe("client");
    expect(evaluateFirewall(subject({ source: "server" }), context()).source).toBe("server");
  });

  it("never claims to be a legal conclusion", () => {
    expect(evaluateFirewall(subject(), context()).legalAdvice).toBe(false);
  });

  it("prefers a vendor the caller already knows over one inferred from the host", () => {
    const result = evaluateFirewall(subject({ vendor: "Declared Vendor" }), context());
    expect(result.vendor).toBe("Declared Vendor");
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe("determinism", () => {
  it("returns the same decision for the same inputs", () => {
    const a = evaluateFirewall(subject(), context());
    const b = evaluateFirewall(subject(), context());
    expect({ ...a, evidence: a.evidence }).toEqual({ ...b, evidence: b.evidence });
  });

  it("matches subdomains the way the catalogue does", () => {
    for (const host of [
      "https://google-analytics.com/c",
      "https://www.google-analytics.com/c",
      "https://ssl.google-analytics.com/c",
    ]) {
      expect(evaluateFirewall(subject({ destination: host }), context()).decision).toBe(
        "REQUIRE_CONSENT",
      );
    }
  });

  it("does not match a host that merely ends with the same letters", () => {
    const result = evaluateFirewall(
      subject({ destination: "https://notgoogle-analytics.com/c" }),
      context(),
    );
    expect(result.decision).toBe("REVIEW");
  });
});
