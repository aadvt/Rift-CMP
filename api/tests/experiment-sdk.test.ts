/**
 * @vitest-environment jsdom
 *
 * Assignment in a browser: stickiness, and the boundary a variant cannot cross.
 *
 * Two things are being tested and they matter for different reasons.
 *
 * **Stickiness.** A visitor who sees one banner, reloads, and sees a different
 * one has been given two different experiences of the same choice. That is a
 * poor experience and a ruined measurement, and it is the failure mode of every
 * assignment scheme that forgets to persist anything.
 *
 * **The copy boundary.** `applyVariant` merges an arm's overrides into a
 * configuration. If it merged anything beyond `text`, an experiment could change
 * what the banner is asking about — so the test asserts that purposes,
 * enforcement and the notice come through by identity, not merely equal.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConsentRuntimeConfig } from "@rift-cmp/shared";
import { applyVariant, browserKey, resolveVariant } from "../../sdk/src/experiment";

function config(over: Partial<ConsentRuntimeConfig> = {}): ConsentRuntimeConfig {
  return {
    site_id: "site-1",
    config_version: "abc",
    purposes: [
      {
        code: "analytics",
        name: "Analytics",
        description: "Understand usage",
        kind: "optional",
        vendors: ["Google Analytics"],
        order: 0,
      },
    ],
    notice: null,
    text: {
      title: "Site title",
      body: "Site body",
      accept_all: "Accept all",
      reject_all: "Reject all",
      manage: "Manage",
      save: "Save",
      policy_url: null,
    },
    enforcement: null,
    ready: true,
    ...over,
  } as ConsentRuntimeConfig;
}

function withExperiment(
  variants: Array<{ key: string; allocation: number; text: Record<string, string> | null }>,
) {
  return config({
    experiment: { experiment_id: "exp-1", variants },
  } as Partial<ConsentRuntimeConfig>);
}

const TWO_ARMS = [
  { key: "control", allocation: 50, text: null },
  { key: "b", allocation: 50, text: { reject_all: "No thanks" } },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

// ─── The key ─────────────────────────────────────────────────────────────────

describe("the browser key", () => {
  it("is minted once and reused", () => {
    const first = browserKey();
    expect(first).toBeTruthy();
    expect(browserKey()).toBe(first);
    expect(browserKey()).toBe(first);
  });

  it("is a new key after site data is cleared", () => {
    // Correct behaviour: a browser that has forgotten everything is a new
    // browser, and should be reassigned rather than remembered.
    const first = browserKey();
    window.localStorage.clear();
    expect(browserKey()).not.toBe(first);
  });

  it("is not the principal id under another name", () => {
    // Deriving the bucket from the consent log's own identifier would tie "what
    // this person was shown" to "what this person decided" through a value the
    // server holds. It is a separate, local value on purpose.
    const key = browserKey();
    expect(window.localStorage.getItem("rift.experiment.key")).toBe(key);
    expect(window.localStorage.getItem("rift.consent.principal")).toBeNull();
  });

  it("looks like a random value rather than anything meaningful", () => {
    expect(browserKey()).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ─── Stickiness ──────────────────────────────────────────────────────────────

describe("stickiness", () => {
  it("returns the same arm across repeated resolutions", () => {
    const first = resolveVariant(withExperiment(TWO_ARMS));
    for (let i = 0; i < 20; i += 1) {
      expect(resolveVariant(withExperiment(TWO_ARMS))?.variantKey).toBe(first?.variantKey);
    }
  });

  it("survives a page reload", () => {
    // A reload is a fresh module with the same storage, which is exactly what
    // re-reading the key models.
    const before = resolveVariant(withExperiment(TWO_ARMS))?.variantKey;
    const key = window.localStorage.getItem("rift.experiment.key");

    // Simulate a new page: nothing in memory, storage intact.
    expect(key).toBeTruthy();
    expect(resolveVariant(withExperiment(TWO_ARMS))?.variantKey).toBe(before);
  });

  it("survives a config reload that reorders the variants", () => {
    const before = resolveVariant(withExperiment(TWO_ARMS))?.variantKey;
    const reversed = [...TWO_ARMS].reverse();
    expect(resolveVariant(withExperiment(reversed))?.variantKey).toBe(before);
  });

  it("reassigns when site data is cleared", () => {
    resolveVariant(withExperiment(TWO_ARMS));
    window.localStorage.clear();
    // A new key, so possibly a new arm. What matters is that it does not throw
    // and that it is stable from here.
    const after = resolveVariant(withExperiment(TWO_ARMS))?.variantKey;
    expect(resolveVariant(withExperiment(TWO_ARMS))?.variantKey).toBe(after);
  });
});

// ─── When not to assign ──────────────────────────────────────────────────────

describe("declining to assign", () => {
  it("returns null when no experiment is running", () => {
    expect(resolveVariant(config())).toBeNull();
  });

  it("returns null for a null config", () => {
    expect(resolveVariant(null)).toBeNull();
  });

  it("returns null when the experiment has no variants", () => {
    expect(resolveVariant(withExperiment([]))).toBeNull();
  });

  it("returns null when allocations do not sum to 100", () => {
    // A broken experiment means "show the site's ordinary banner". Assigning
    // anyway would run something nobody configured, and leave attribution
    // behind to be miscounted later.
    expect(
      resolveVariant(
        withExperiment([
          { key: "a", allocation: 30, text: null },
          { key: "b", allocation: 30, text: null },
        ]),
      ),
    ).toBeNull();
  });

  it("does not assign an arm allocated zero", () => {
    for (let i = 0; i < 20; i += 1) {
      window.localStorage.clear();
      const assigned = resolveVariant(
        withExperiment([
          { key: "live", allocation: 100, text: null },
          { key: "off", allocation: 0, text: null },
        ]),
      );
      expect(assigned?.variantKey).toBe("live");
    }
  });
});

// ─── The copy boundary ───────────────────────────────────────────────────────

describe("what a variant can change", () => {
  const variant = {
    experimentId: "exp-1",
    variantKey: "b",
    text: { reject_all: "No thanks", title: "Your choices" },
  };

  it("overrides only the strings it names", () => {
    const varied = applyVariant(config(), variant);
    expect(varied.text.reject_all).toBe("No thanks");
    expect(varied.text.title).toBe("Your choices");
    // Untouched, so an arm can vary one line without restating the rest.
    expect(varied.text.body).toBe("Site body");
    expect(varied.text.accept_all).toBe("Accept all");
  });

  it("leaves the purposes identical, not merely equal", () => {
    // Identity rather than deep equality: an experiment must not be able to
    // produce a *different* purpose list that happens to look the same today.
    const base = config();
    const varied = applyVariant(base, variant);
    expect(varied.purposes).toBe(base.purposes);
  });

  it("leaves enforcement identical", () => {
    const base = config({
      enforcement: {
        mode: "enforce",
        rules: [
          {
            host: "google-analytics.com",
            vendor: "Google Analytics",
            purpose: "analytics",
            action: "block",
          },
        ],
        unknown_host: "allow",
      },
    });
    const varied = applyVariant(base, variant);

    // The whole safety argument in one assertion: whatever an arm says, the
    // rules the browser enforces are the ones the server sent.
    expect(varied.enforcement).toBe(base.enforcement);
  });

  it("leaves the notice identical", () => {
    const base = config({
      notice: {
        notice_id: "n1",
        version: "1",
        locale: "en",
        policy_version_id: "pv1",
        document_url: null,
      },
    });
    expect(applyVariant(base, variant).notice).toBe(base.notice);
  });

  it("returns the configuration unchanged for an arm with no copy", () => {
    const base = config();
    expect(applyVariant(base, { experimentId: "e", variantKey: "control", text: null })).toBe(base);
  });

  it("returns the configuration unchanged when nothing was assigned", () => {
    const base = config();
    expect(applyVariant(base, null)).toBe(base);
  });

  it("ignores a null override rather than blanking the string", () => {
    // `null` means "this arm does not vary this line", which is different from
    // "this arm sets this line to nothing" — and blanking a reject control is
    // the thing the whole design refuses to allow.
    const varied = applyVariant(config(), {
      experimentId: "e",
      variantKey: "b",
      text: { reject_all: null },
    });
    expect(varied.text.reject_all).toBe("Reject all");
  });

  it("cannot reach anything outside text, even when handed extra fields", () => {
    const base = config();
    const hostile = {
      experimentId: "e",
      variantKey: "b",
      text: {
        title: "Hi",
        // Not part of the type, and not merged: `applyVariant` copies named
        // fields rather than spreading whatever it was given.
        purposes: [],
        enforcement: { mode: "off" },
      },
    } as never;

    const varied = applyVariant(base, hostile);
    expect(varied.purposes).toBe(base.purposes);
    expect(varied.enforcement).toBe(base.enforcement);
    expect((varied as unknown as Record<string, unknown>).purposes).toEqual(base.purposes);
  });
});
