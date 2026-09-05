import type { ConsentRuntimeConfig } from "@rift-cmp/shared";
import { assignVariant } from "@rift-cmp/shared";

/**
 * Which consent experience this browser is in.
 *
 * ## The key never leaves the browser
 *
 * Assignment needs something stable per browser. It does not need an identity,
 * and giving it one would be the wrong trade: a server-side assignment table
 * would be a per-visitor record of what somebody was shown, which is a new
 * category of personal data created purely so a dashboard can compare two
 * headlines.
 *
 * So the key is generated here, stored here, and never transmitted. What reaches
 * the server is the *arm* — `"control"` or `"b"` — attached to a consent
 * decision that was going to be recorded anyway. The server learns which arm a
 * decision belongs to and never which browser is in which arm.
 *
 * The cost is that somebody editing their own storage can choose their own arm.
 * That is accepted. The threat model for a copy experiment is an operator
 * drawing a wrong conclusion from skewed data, not a visitor gaming a banner
 * they are already free to ignore, and the volume needed to move a rate is far
 * beyond what hand-editing achieves.
 *
 * ## Deliberately separate from the principal id
 *
 * The obvious shortcut is to reuse `consent.getPrincipalId()`. It is not used,
 * for two reasons. It is null until a decision is recorded, so it cannot assign
 * the banner that asks for that decision — the exact moment an experiment is
 * about. And it is the identifier the consent log is keyed on: deriving a
 * behavioural bucket from it would tie "what this person was shown" to "what
 * this person decided" through a value the server holds, which is the link the
 * rest of this architecture goes to some length not to have.
 */

const KEY_STORAGE = "rift.experiment.key";

export interface AssignedVariant {
  experimentId: string;
  variantKey: string;
  /** The copy overrides for this arm, or null where it uses the site's own. */
  text: Partial<ConsentRuntimeConfig["text"]> | null;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Blocked by a privacy setting, or an environment without one. Not an error.
    return null;
  }
}

/**
 * A random per-browser value, minted on first need.
 *
 * Not an identifier for a person: it is scoped to this origin's storage, never
 * sent anywhere, and carries no meaning outside `assignVariant`. Clearing site
 * data mints a new one and reassigns this browser, which is the correct
 * behaviour — a browser that has forgotten everything is a new browser.
 */
export function browserKey(): string | null {
  const store = storage();
  if (!store) {
    // Without storage there is no stickiness, and an arm that changed on every
    // page load would be worse than no experiment: the visitor sees a different
    // banner each time and the measurement is noise. Opt out instead.
    return null;
  }

  try {
    const existing = store.getItem(KEY_STORAGE);
    if (existing) return existing;

    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    const minted = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    store.setItem(KEY_STORAGE, minted);
    return minted;
  } catch {
    return null;
  }
}

/**
 * The arm to render, or null to render the site's ordinary banner.
 *
 * Null on every uncertain path — no experiment, no storage, allocations that do
 * not sum to 100, an arm that vanished from the config. "Show what the site
 * normally shows" is the only safe reading of a broken experiment, and it is
 * also the one that leaves no attribution behind to be miscounted later.
 */
export function resolveVariant(config: ConsentRuntimeConfig | null): AssignedVariant | null {
  const experiment = config?.experiment;
  if (!experiment || experiment.variants.length === 0) return null;

  const key = browserKey();
  if (!key) return null;

  const variantKey = assignVariant(experiment.experiment_id, key, experiment.variants);
  if (!variantKey) return null;

  const variant = experiment.variants.find((v) => v.key === variantKey);
  if (!variant) return null;

  return {
    experimentId: experiment.experiment_id,
    variantKey,
    text: variant.text ?? null,
  };
}

/**
 * Apply an arm's copy to a configuration.
 *
 * Returns a new configuration with `text` merged and everything else — purposes,
 * enforcement, notice — carried through untouched by reference. That is the
 * whole mechanism: the only thing a variant can reach is the copy object, so
 * there is no path by which one could alter what the banner is asking about.
 *
 * An override that is null or undefined falls through to the site's own string,
 * so an arm can vary one line without restating the rest.
 */
export function applyVariant(
  config: ConsentRuntimeConfig,
  variant: AssignedVariant | null,
): ConsentRuntimeConfig {
  if (!variant?.text) return config;

  const overrides = variant.text;
  return {
    ...config,
    text: {
      ...config.text,
      ...(overrides.title == null ? {} : { title: overrides.title }),
      ...(overrides.body == null ? {} : { body: overrides.body }),
      ...(overrides.accept_all == null ? {} : { accept_all: overrides.accept_all }),
      ...(overrides.reject_all == null ? {} : { reject_all: overrides.reject_all }),
      ...(overrides.manage == null ? {} : { manage: overrides.manage }),
      ...(overrides.save == null ? {} : { save: overrides.save }),
    },
  };
}
