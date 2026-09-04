/**
 * @vitest-environment jsdom
 *
 * The consent experience: configuration, banner, preference centre.
 *
 * Phase 8B names the scenarios these cover — banner rendering, preferences,
 * grant, deny, withdraw, jurisdiction-specific configuration, configuration
 * loading, the no-consent state, and the installation snippet.
 *
 * Two properties matter more than any single scenario, and both are asserted
 * directly rather than implied:
 *
 *  - **The browser does no legal reasoning.** The runtime configuration carries
 *    no regime, jurisdiction, citation or requirement, and a test greps the
 *    serialised payload to prove it.
 *  - **No legal text is invented.** Every string the banner can render is
 *    either operator-authored or comes from a fallback that makes no legal
 *    claim.
 *
 * No database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProposal,
  buildRuntimeConfig,
  configVersion,
  type DeclaredPurpose,
} from "@/lib/consent-config";
import {
  buildInstallSnippet,
  buildPreferencesSnippet,
} from "@/lib/install-snippet";
import { ConsentUi } from "../../sdk/src/ui";
import type { ConsentApi, ConsentRecordOptions } from "../../sdk/src/consent";
import type { ConsentRuntimeConfig } from "@rift-cmp/shared";
import { CONSENT_FALLBACK_TEXT } from "@rift-cmp/shared";
import type { EffectiveConsent } from "@rift-cmp/shared";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

const PURPOSES: DeclaredPurpose[] = [
  {
    code: "analytics",
    name: "Analytics",
    description: "Understanding how the site is used.",
    isActive: true,
  },
  {
    code: "essential",
    name: "Essential",
    description: "Needed for the site to work.",
    isActive: true,
  },
  {
    code: "marketing",
    name: "Marketing",
    description: "Campaign measurement.",
    isActive: false,
  },
];

function config(over: Partial<Parameters<typeof buildRuntimeConfig>[0]> = {}) {
  return buildRuntimeConfig({
    siteId: "site_demo",
    purposes: PURPOSES,
    notice: null,
    ...over,
  });
}

// ─── Configuration ───────────────────────────────────────────────────────────

describe("the runtime configuration", () => {
  it("includes only active purposes", () => {
    const c = config();
    expect(c.purposes.map((p) => p.code)).toEqual(["analytics", "essential"]);
  });

  it("marks a conventionally essential purpose as locked, and nothing else", () => {
    const c = config();
    expect(c.purposes.find((p) => p.code === "essential")!.kind).toBe("essential");
    expect(c.purposes.find((p) => p.code === "analytics")!.kind).toBe("optional");
  });

  it("defaults to optional, which is the conservative direction", () => {
    // Rendering a locked purpose as switchable costs the operator a toggle;
    // the reverse denies a visitor a choice they were entitled to.
    const c = buildRuntimeConfig({
      siteId: "s",
      purposes: [
        { code: "something_new", name: "N", description: "d", isActive: true },
      ],
      notice: null,
    });
    expect(c.purposes[0].kind).toBe("optional");
  });

  it("orders purposes stably, so a banner does not reshuffle between loads", () => {
    const forward = config().purposes.map((p) => p.code);
    const reversed = buildRuntimeConfig({
      siteId: "site_demo",
      purposes: [...PURPOSES].reverse(),
      notice: null,
    }).purposes.map((p) => p.code);
    expect(reversed).toEqual(forward);
  });

  it("is not ready when no purposes are declared", () => {
    // A banner offering no choices looks like a consent mechanism and is not
    // one, so the runtime renders nothing at all.
    const c = buildRuntimeConfig({ siteId: "s", purposes: [], notice: null });
    expect(c.ready).toBe(false);
    expect(c.purposes).toEqual([]);
  });

  it("versions on content, so an unchanged site keeps one version", () => {
    expect(configVersion(config().purposes, null)).toBe(
      configVersion(config().purposes, null),
    );
  });

  it("changes version when a rendered field changes", () => {
    const before = config().purposes;
    const after = buildRuntimeConfig({
      siteId: "site_demo",
      purposes: PURPOSES.map((p) =>
        p.code === "analytics" ? { ...p, name: "Site analytics" } : p,
      ),
      notice: null,
    }).purposes;
    expect(configVersion(after, null)).not.toBe(configVersion(before, null));
  });

  it("carries the notice so a decision can cite what was shown", () => {
    const c = config({
      notice: {
        noticeId: "n1",
        version: "1.0.0",
        locale: "en",
        policyVersionId: "pv1",
        documentUrl: "https://example.com/privacy",
      },
    });
    expect(c.notice!.notice_id).toBe("n1");
    expect(c.text.policy_url).toBe("https://example.com/privacy");
  });

  it("carries no legal reasoning into the browser", () => {
    /**
     * The load-bearing assertion of the phase. Whatever the server decided, none
     * of it may cross into a bundle that ships to every visitor.
     */
    const serialised = JSON.stringify(config()).toLowerCase();
    for (const term of [
      "gdpr",
      "eprivacy",
      "dpdp",
      "ccpa",
      "lgpd",
      "regime",
      "jurisdiction",
      "requirement",
      "req-",
      "obligation",
      "citation",
      "lawful",
      "legal_basis",
    ]) {
      expect(serialised, `runtime config leaks ${term}`).not.toContain(term);
    }
  });

  it("invents no legal text: every string is operator-authored or null", () => {
    const c = config();
    for (const value of Object.values(c.text)) {
      expect(value).toBeNull();
    }
  });
});

// ─── Jurisdiction-specific configuration ─────────────────────────────────────

describe("jurisdiction-specific configuration", () => {
  it("annotates a proposal with the regimes the engine found", () => {
    const proposal = buildProposal({
      siteId: "site_demo",
      scanId: "scan_1",
      technologies: [
        { name: "Google Analytics", category: "analytics", confidence: "high" },
      ],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(proposal.jurisdictions).toEqual(["EU"]);
    expect(proposal.regimes).toContain("GDPR");
    expect(proposal.regimes).toContain("EU-ePrivacy");
  });

  it("produces a different reading for a different market", () => {
    const brazil = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [],
      declaredPurposes: [],
      locationSignals: [{ region: "BR", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(brazil.jurisdictions).toEqual(["Brazil"]);
    expect(brazil.regimes).toEqual(["Brazil-LGPD"]);
  });

  it("resolves several jurisdictions at once rather than picking one", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [],
      declaredPurposes: [],
      locationSignals: [
        { region: "DE", source: "business_target_market" },
        { region: "BR", source: "business_target_market" },
      ],
      asOf: AS_OF,
    });
    expect(proposal.jurisdictions).toEqual(["Brazil", "EU"]);
  });

  it("says it needs review, and never claims to be advice", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(proposal.requires_review).toBe(true);
    expect(proposal.legal_advice).toBe(false);
  });

  it("carries every open question rather than summarising them away", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    // The engine returns REVIEW far more often than it returns an obligation;
    // hiding that would make the proposal look more settled than the research is.
    expect(proposal.open_questions.length).toBeGreaterThan(0);
  });

  it("surfaces a technology no suggestion covers instead of dropping it", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [
        { name: "Mystery Co", category: "unclassified", confidence: "low" },
      ],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(proposal.unmapped_technologies.map((t) => t.name)).toEqual(["Mystery Co"]);
  });

  it("marks a suggestion that the operator has already declared", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [
        { name: "Google Analytics", category: "analytics", confidence: "high" },
      ],
      declaredPurposes: [
        { code: "analytics", name: "A", description: "d", isActive: true },
      ],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(proposal.purposes[0].already_declared).toBe(true);
  });

  it("does not upgrade confidence by the act of proposing", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [
        { name: "A", category: "analytics", confidence: "high" },
        { name: "B", category: "analytics", confidence: "low" },
      ],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    expect(proposal.purposes[0].confidence).toBe("low");
  });

  it("gives every suggestion evidence a reviewer can check", () => {
    const proposal = buildProposal({
      siteId: "s",
      scanId: null,
      technologies: [
        { name: "Google Analytics", category: "analytics", confidence: "high" },
      ],
      declaredPurposes: [],
      locationSignals: [{ region: "DE", source: "business_target_market" }],
      asOf: AS_OF,
    });
    const evidence = proposal.purposes[0].evidence;
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => e.kind === "scan_technology")).toBe(true);
    const regime = evidence.find((e) => e.kind === "regulation");
    if (regime) {
      expect(regime.requirement_id).toMatch(/^REQ-/);
      expect(regime.source_ids!.length).toBeGreaterThan(0);
    }
  });
});

// ─── The banner ──────────────────────────────────────────────────────────────

class FakeConsent implements ConsentApi {
  state: EffectiveConsent[] = [];
  calls: Array<[string, string]> = [];

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
  async record(code: string, status: string) {
    this.calls.push(["record", `${code}:${status}`]);
    return true;
  }
  async grant(code: string, options?: ConsentRecordOptions) {
    void options;
    this.calls.push(["grant", code]);
    return true;
  }
  async deny(code: string, options?: ConsentRecordOptions) {
    void options;
    this.calls.push(["deny", code]);
    return true;
  }
  async withdraw(code: string, options?: ConsentRecordOptions) {
    void options;
    this.calls.push(["withdraw", code]);
    return true;
  }
  getPrincipalId() {
    return "p1";
  }
  getSessionToken() {
    return "cs_x";
  }
  clear() {}
}

function decided(code: string, status: EffectiveConsent["status"]): EffectiveConsent {
  return {
    purpose_code: code,
    status,
    decided_at: AS_OF.toISOString(),
    consent_record_id: `r_${code}`,
    notice_id: null,
    policy_version_id: null,
  };
}

function ui(consent: ConsentApi, runtime: ConsentRuntimeConfig, force = false) {
  const fetchRef = vi.fn(async () =>
    new Response(JSON.stringify(runtime), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;

  return {
    instance: new ConsentUi(consent, {
      apiUrl: "https://api.test",
      publicKey: "pk_test",
      force,
      fetchRef,
      documentRef: document,
    }),
    fetchRef,
  };
}

function textOf(root: ShadowRoot | null): string {
  return root?.textContent ?? "";
}

function buttons(root: ShadowRoot | null): HTMLButtonElement[] {
  return [...(root?.querySelectorAll("button") ?? [])];
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("banner rendering", () => {
  it("renders the three choices the brief names", async () => {
    const consent = new FakeConsent();
    const { instance } = ui(consent, config());
    expect(await instance.showBannerIfNeeded()).toBe(true);

    const labels = buttons(instance.shadow).map((b) => b.textContent);
    expect(labels).toContain(CONSENT_FALLBACK_TEXT.accept_all);
    expect(labels).toContain(CONSENT_FALLBACK_TEXT.reject_all);
    expect(labels).toContain(CONSENT_FALLBACK_TEXT.manage);
  });

  it("is a labelled modal dialog", async () => {
    const { instance } = ui(new FakeConsent(), config());
    await instance.showBannerIfNeeded();
    const panel = instance.shadow!.querySelector('[role="dialog"]')!;
    expect(panel.getAttribute("aria-modal")).toBe("true");
    const labelledBy = panel.getAttribute("aria-labelledby")!;
    expect(instance.shadow!.getElementById(labelledBy)).not.toBeNull();
  });

  it("renders inside a shadow root, so a host stylesheet cannot hide reject", async () => {
    const { instance } = ui(new FakeConsent(), config());
    await instance.showBannerIfNeeded();
    expect(instance.shadow).not.toBeNull();
    expect(document.getElementById("rift-consent-root")!.shadowRoot).not.toBeNull();
  });

  it("uses operator copy when there is any", async () => {
    const withCopy = config({
      text: { title: "Our cookie notice", accept_all: "Yes, allow" },
    });
    const { instance } = ui(new FakeConsent(), withCopy);
    await instance.showBannerIfNeeded();
    expect(textOf(instance.shadow)).toContain("Our cookie notice");
    expect(buttons(instance.shadow).map((b) => b.textContent)).toContain("Yes, allow");
  });

  it("falls back to text that makes no legal claim", async () => {
    const { instance } = ui(new FakeConsent(), config());
    await instance.showBannerIfNeeded();
    const rendered = textOf(instance.shadow).toLowerCase();
    for (const term of ["gdpr", "legally", "required by law", "we are required"]) {
      expect(rendered).not.toContain(term);
    }
  });

  it("offers no dismissal that records nothing", async () => {
    // A close button that silently means "no" is a decision made for the
    // visitor; one that silently means "yes" is worse.
    const { instance } = ui(new FakeConsent(), config());
    await instance.showBannerIfNeeded();
    const labels = buttons(instance.shadow).map((b) => (b.textContent ?? "").toLowerCase());
    expect(labels).not.toContain("×");
    expect(labels).not.toContain("close");
    expect(labels).not.toContain("dismiss");
  });
});

describe("the no-consent state", () => {
  it("shows the banner when nothing has been decided", async () => {
    const { instance } = ui(new FakeConsent(), config());
    expect(await instance.showBannerIfNeeded()).toBe(true);
  });

  it("does not show it again once every purpose has a decision", async () => {
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "DENIED")];
    const { instance } = ui(consent, config());
    expect(await instance.showBannerIfNeeded()).toBe(false);
  });

  it("shows it again when a new purpose is added", async () => {
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "GRANTED")];
    const extended = buildRuntimeConfig({
      siteId: "site_demo",
      purposes: [
        ...PURPOSES,
        { code: "advertising", name: "Ads", description: "d", isActive: true },
      ],
      notice: null,
    });
    const { instance } = ui(consent, extended);
    expect(await instance.showBannerIfNeeded()).toBe(true);
  });

  it("treats a withdrawn purpose as decided, not as unasked", async () => {
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "WITHDRAWN")];
    const { instance } = ui(consent, config());
    expect(await instance.showBannerIfNeeded()).toBe(false);
  });

  it("renders nothing at all when the site declares no purposes", async () => {
    const empty = buildRuntimeConfig({ siteId: "s", purposes: [], notice: null });
    const { instance } = ui(new FakeConsent(), empty);
    expect(await instance.showBannerIfNeeded()).toBe(false);
    expect(document.getElementById("rift-consent-root")).toBeNull();
  });
});

describe("configuration loading", () => {
  it("fetches the config with the site public key", async () => {
    const { instance, fetchRef } = ui(new FakeConsent(), config());
    await instance.loadConfig();
    const [url, init] = (fetchRef as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://api.test/api/v1/consent/config");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer pk_test",
    });
  });

  it("renders nothing when the config cannot be fetched", async () => {
    const consent = new FakeConsent();
    const instance = new ConsentUi(consent, {
      apiUrl: "https://api.test",
      publicKey: "pk_test",
      documentRef: document,
      fetchRef: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    });
    // A failed fetch is not evidence that consent is unnecessary, and it is not
    // grounds to invent content either.
    expect(await instance.showBannerIfNeeded()).toBe(false);
    expect(document.getElementById("rift-consent-root")).toBeNull();
  });

  it("renders nothing on a non-200", async () => {
    const instance = new ConsentUi(new FakeConsent(), {
      apiUrl: "https://api.test",
      publicKey: "pk_test",
      documentRef: document,
      fetchRef: (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
    });
    expect(await instance.loadConfig()).toBeNull();
  });
});

describe("preferences, grant, deny and withdraw", () => {
  it("lists every purpose with a control", async () => {
    const { instance } = ui(new FakeConsent(), config(), true);
    await instance.showPreferences();
    const boxes = [...instance.shadow!.querySelectorAll("input[type=checkbox]")];
    expect(boxes).toHaveLength(2);
  });

  it("locks an essential purpose on, and shows it rather than hiding it", async () => {
    const { instance } = ui(new FakeConsent(), config(), true);
    await instance.showPreferences();
    const essential = instance.shadow!.getElementById(
      "rift-purpose-essential",
    ) as HTMLInputElement;
    expect(essential.checked).toBe(true);
    expect(essential.disabled).toBe(true);
    expect(textOf(instance.shadow)).toContain("Always active");
  });

  it("reflects the decisions currently in force", async () => {
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "GRANTED")];
    const { instance } = ui(consent, config(), true);
    await instance.showPreferences();
    const analytics = instance.shadow!.getElementById(
      "rift-purpose-analytics",
    ) as HTMLInputElement;
    expect(analytics.checked).toBe(true);
  });

  it("grants everything on accept all", async () => {
    const consent = new FakeConsent();
    const { instance } = ui(consent, config());
    await instance.showBannerIfNeeded();
    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.accept_all)!
      .click();
    await vi.waitFor(() => expect(consent.calls.length).toBe(2));
    expect(consent.calls).toEqual([
      ["grant", "analytics"],
      ["grant", "essential"],
    ]);
  });

  it("denies the optional ones on reject all, keeping essential", async () => {
    const consent = new FakeConsent();
    const { instance } = ui(consent, config());
    await instance.showBannerIfNeeded();
    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.reject_all)!
      .click();
    await vi.waitFor(() => expect(consent.calls.length).toBe(2));
    expect(consent.calls).toEqual([
      ["deny", "analytics"],
      ["grant", "essential"],
    ]);
  });

  it("withdraws rather than denies when a purpose was previously granted", async () => {
    /**
     * The distinction the append-only log exists to preserve: "declined" and
     * "changed their mind" are different facts, and a preference centre that
     * recorded both as DENIED would destroy the second.
     */
    const consent = new FakeConsent();
    consent.state = [decided("analytics", "GRANTED")];
    const { instance } = ui(consent, config(), true);
    await instance.showPreferences();

    const analytics = instance.shadow!.getElementById(
      "rift-purpose-analytics",
    ) as HTMLInputElement;
    analytics.checked = false;

    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.save)!
      .click();
    await vi.waitFor(() => expect(consent.calls.length).toBe(2));
    expect(consent.calls).toContainEqual(["withdraw", "analytics"]);
    expect(consent.calls).not.toContainEqual(["deny", "analytics"]);
  });

  it("cites the notice the choice was made under", async () => {
    const consent = new FakeConsent();
    const grant = vi.spyOn(consent, "grant");
    const withNotice = config({
      notice: {
        noticeId: "n1",
        version: "1.0.0",
        locale: "en",
        policyVersionId: "pv1",
        documentUrl: null,
      },
    });
    const { instance } = ui(consent, withNotice);
    await instance.showBannerIfNeeded();
    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.accept_all)!
      .click();
    await vi.waitFor(() => expect(grant).toHaveBeenCalled());
    expect(grant.mock.calls[0][1]).toMatchObject({
      noticeId: "n1",
      policyVersionId: "pv1",
    });
  });

  it("closes after a decision, so the banner does not linger", async () => {
    const consent = new FakeConsent();
    const { instance } = ui(consent, config());
    await instance.showBannerIfNeeded();
    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.accept_all)!
      .click();
    await vi.waitFor(() =>
      expect(document.getElementById("rift-consent-root")).toBeNull(),
    );
  });

  it("opens the preference centre from the banner", async () => {
    const { instance } = ui(new FakeConsent(), config());
    await instance.showBannerIfNeeded();
    buttons(instance.shadow)
      .find((b) => b.textContent === CONSENT_FALLBACK_TEXT.manage)!
      .click();
    await vi.waitFor(() =>
      expect(
        instance.shadow!.querySelectorAll("input[type=checkbox]").length,
      ).toBeGreaterThan(0),
    );
  });
});

// ─── The installation snippet ────────────────────────────────────────────────

describe("the installation snippet", () => {
  const input = {
    siteId: "site_demo",
    publicKey: "pk_demo_12345",
    origin: "https://app.example.com",
  };

  it("is one block carrying the site's own identifiers", () => {
    const snippet = buildInstallSnippet(input);
    expect(snippet).toContain("site_demo");
    expect(snippet).toContain("pk_demo_12345");
    expect(snippet).toContain("https://app.example.com/js/rift-cmp.js");
  });

  it("initialises, gates events and shows the banner", () => {
    const snippet = buildInstallSnippet(input);
    expect(snippet).toContain("analytics.init(");
    expect(snippet).toContain("analytics.setConsentCheck(");
    expect(snippet).toContain("analytics.banner.show()");
  });

  it("hard-codes no purpose, so the dashboard stays the source of truth", () => {
    /**
     * The property that makes this a snippet rather than a configuration file.
     * A baked-in purpose list guarantees the banner and the consent log
     * disagree the first time either changes.
     */
    const snippet = buildInstallSnippet(input);
    for (const term of ["analytics\"", "marketing", "essential", "purposes"]) {
      expect(snippet).not.toContain(term);
    }
  });

  it("carries no legal text and no secret", () => {
    const snippet = buildInstallSnippet(input).toLowerCase();
    for (const term of ["gdpr", "consent is required", "sk_", "lawful"]) {
      expect(snippet).not.toContain(term);
    }
  });

  it("omits the banner when nothing is declared", () => {
    const snippet = buildInstallSnippet({ ...input, withBanner: false });
    expect(snippet).not.toContain("analytics.banner.show()");
    expect(snippet).toContain("analytics.init(");
  });

  it("escapes anything that could break out of the string literal", () => {
    const snippet = buildInstallSnippet({
      ...input,
      siteId: 'evil"; alert(1); //',
    });
    // The quote must be escaped, so the literal never terminates early.
    expect(snippet).toContain('evil\\";');
    expect(snippet).not.toContain('"evil";');
  });

  it("cannot be made to close the script tag early", () => {
    const snippet = buildInstallSnippet({
      ...input,
      publicKey: "pk_</script><script>alert(1)</script>",
    });
    expect(snippet.toLowerCase()).not.toContain("</script><script>");
  });

  it("offers a separate control for changing a decision later", () => {
    const preferences = buildPreferencesSnippet();
    expect(preferences).toContain("analytics.banner.showPreferences()");
  });

  it("trims a trailing slash rather than producing a double one", () => {
    const snippet = buildInstallSnippet({ ...input, origin: "https://app.example.com/" });
    expect(snippet).not.toContain("com//js");
  });
});
