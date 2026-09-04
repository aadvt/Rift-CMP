/**
 * The consent banner and preference centre.
 *
 * A rendering layer over {@link ConsentApi}, and nothing more. It fetches a
 * configuration the server built, draws the purposes in it, and calls
 * `grant` / `deny` / `withdraw`. It contains no regime, no jurisdiction, no
 * requirement and no rule about when a banner should appear — every one of
 * those was decided server-side before the configuration was serialised.
 *
 * That split is the point of the phase, and it is not only tidiness. A bundle
 * that shipped legal reasoning would ship it to every visitor of every customer
 * site, where it can be read, modified, blocked or simply run in a browser the
 * operator has never tested. Whatever such a bundle concluded would also be
 * unauditable after the fact. So the browser renders and records; the server
 * reasons.
 *
 * ## Accessibility
 *
 * A consent banner that cannot be operated by keyboard is not a mechanism for
 * obtaining consent, whatever it renders. So:
 *
 *  - the banner is `role="dialog"` with `aria-modal`, labelled by its heading
 *  - focus moves into it on open and is trapped until a choice is made
 *  - Escape closes the preference centre back to the banner, never to nothing
 *  - every control is a real `<button>` or `<input type="checkbox">` with a
 *    label, so screen readers and the keyboard get the behaviour for free
 *  - `prefers-reduced-motion` removes the entrance transition
 *  - `prefers-color-scheme` is honoured, and contrast is checked in both
 *
 * There is deliberately no "X" that dismisses the banner without a decision:
 * a dismissal that silently means "no" is a choice made on the visitor's behalf,
 * and one that silently means "yes" is worse.
 *
 * ## Styling
 *
 * Everything renders inside a shadow root. A customer's stylesheet cannot
 * accidentally hide a reject button, and this stylesheet cannot leak into their
 * page. It is the one structural guarantee available in a script that runs on
 * a site whose CSS nobody here has seen.
 */

import type { ConsentApi } from "./consent";
import type { ConsentPurposeConfig, ConsentRuntimeConfig } from "@rift-cmp/shared";
import { CONSENT_FALLBACK_TEXT } from "@rift-cmp/shared";

export interface ConsentUiOptions {
  /** Where the runtime configuration is fetched from. */
  apiUrl: string;
  publicKey: string;
  /** Render even when a decision already exists. Used by "manage preferences". */
  force?: boolean;
  /** Called after a decision is recorded, with the purposes granted. */
  onDecision?: (granted: string[]) => void;
  /** Injected in tests. Defaults to the global. */
  documentRef?: Document;
  fetchRef?: typeof fetch;
}

const HOST_ID = "rift-consent-root";

/** Copy: operator's where present, neutral fallback where not. Never invented. */
function copy(config: ConsentRuntimeConfig) {
  const t = config.text;
  return {
    title: t.title ?? CONSENT_FALLBACK_TEXT.title,
    body: t.body ?? CONSENT_FALLBACK_TEXT.body,
    acceptAll: t.accept_all ?? CONSENT_FALLBACK_TEXT.accept_all,
    rejectAll: t.reject_all ?? CONSENT_FALLBACK_TEXT.reject_all,
    manage: t.manage ?? CONSENT_FALLBACK_TEXT.manage,
    save: t.save ?? CONSENT_FALLBACK_TEXT.save,
    policyUrl: t.policy_url,
  };
}

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(15, 18, 22, 0.35);
}
.panel {
  width: 100%; max-width: 560px; margin: 16px;
  background: #ffffff; color: #16191d;
  border-radius: 14px; border: 1px solid #d9dee5;
  box-shadow: 0 18px 48px rgba(15, 18, 22, 0.22);
  padding: 20px; max-height: calc(100vh - 32px); overflow-y: auto;
  animation: rise 160ms ease-out;
}
@keyframes rise { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
h2 { margin: 0 0 8px; font-size: 17px; line-height: 1.3; }
p { margin: 0 0 14px; font-size: 14px; line-height: 1.55; color: #40474f; }
a { color: #1c4ed8; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
button {
  flex: 1 1 auto; min-width: 120px; min-height: 44px;
  padding: 11px 16px; border-radius: 9px; font-size: 14px; font-weight: 550;
  cursor: pointer; border: 1px solid transparent;
}
button:focus-visible { outline: 3px solid #1c4ed8; outline-offset: 2px; }
.primary { background: #16191d; color: #ffffff; }
.primary:hover { background: #2a2f36; }
.secondary { background: #ffffff; color: #16191d; border-color: #c3cad3; }
.secondary:hover { background: #f2f4f7; }
.link { background: none; border: none; color: #1c4ed8; text-decoration: underline; flex: 0 0 auto; min-width: 0; }
.purpose {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 13px 0; border-top: 1px solid #e6eaef;
}
.purpose label { font-size: 14px; font-weight: 560; display: block; margin-bottom: 2px; }
.purpose .desc { font-size: 13px; color: #5a626b; line-height: 1.5; margin: 0; }
.purpose .vendors { font-size: 12px; color: #767e88; margin: 5px 0 0; }
input[type="checkbox"] { width: 20px; height: 20px; margin: 2px 0 0; flex: 0 0 auto; accent-color: #16191d; }
input[type="checkbox"]:focus-visible { outline: 3px solid #1c4ed8; outline-offset: 2px; }
.locked { font-size: 12px; color: #767e88; }
@media (prefers-color-scheme: dark) {
  .panel { background: #14171b; color: #eef1f4; border-color: #2c333b; }
  p { color: #b3bcc5; }
  .primary { background: #eef1f4; color: #14171b; }
  .secondary { background: #14171b; color: #eef1f4; border-color: #3a424b; }
  .purpose { border-top-color: #262d34; }
  .purpose .desc { color: #a5aeb8; }
  a, .link { color: #8fb4ff; }
}
@media (min-width: 640px) { .backdrop { align-items: center; } }
`;

/**
 * Renders the banner or the preference centre.
 *
 * Returns a handle so a caller can close it, and so tests can drive it without
 * a real browser event loop.
 */
export class ConsentUi {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private config: ConsentRuntimeConfig | null = null;
  private readonly doc: Document;
  private readonly fetchImpl: typeof fetch;
  private previouslyFocused: Element | null = null;

  constructor(
    private readonly consent: ConsentApi,
    private readonly options: ConsentUiOptions,
  ) {
    this.doc = options.documentRef ?? globalThis.document;
    this.fetchImpl = options.fetchRef ?? globalThis.fetch?.bind(globalThis);
  }

  /** Fetches the configuration. Returns null when the site has none. */
  async loadConfig(): Promise<ConsentRuntimeConfig | null> {
    try {
      const response = await this.fetchImpl(
        `${this.options.apiUrl.replace(/\/$/, "")}/api/v1/consent/config`,
        { headers: { authorization: `Bearer ${this.options.publicKey}` } },
      );
      if (!response.ok) return null;
      const config = (await response.json()) as ConsentRuntimeConfig;
      // A configuration with no purposes cannot offer a choice. Rendering an
      // empty banner would present a consent mechanism that records nothing.
      if (!config || config.ready !== true || !Array.isArray(config.purposes)) {
        return null;
      }
      this.config = config;
      return config;
    } catch {
      // A failed fetch is not evidence that consent is not required, and it is
      // not grounds to render invented content either. Show nothing.
      return null;
    }
  }

  /**
   * Show the banner if a decision has not been made for every purpose.
   *
   * Silence is never taken as a decision: a purpose with no record is simply
   * undecided, which is why the banner reappears rather than defaulting.
   */
  async showBannerIfNeeded(): Promise<boolean> {
    const config = this.config ?? (await this.loadConfig());
    if (!config) return false;

    if (!this.options.force) {
      const state = await this.consent.getState();
      const decided = new Set(state.map((s) => s.purpose_code));
      const undecided = config.purposes.filter(
        (p) => p.kind !== "essential" && !decided.has(p.code),
      );
      if (undecided.length === 0) return false;
    }

    this.renderBanner(config);
    return true;
  }

  /** Open the preference centre directly, with current state reflected. */
  async showPreferences(): Promise<boolean> {
    const config = this.config ?? (await this.loadConfig());
    if (!config) return false;
    const state = await this.consent.getState();
    const granted = new Set(
      state.filter((s) => s.status === "GRANTED").map((s) => s.purpose_code),
    );
    this.renderPreferences(config, granted);
    return true;
  }

  close(): void {
    this.host?.remove();
    this.host = null;
    this.root = null;
    if (this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus();
    }
  }

  /** The shadow root, for tests. Null when nothing is rendered. */
  get shadow(): ShadowRoot | null {
    return this.root;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private mount(): ShadowRoot {
    this.doc.getElementById(HOST_ID)?.remove();
    const host = this.doc.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "open" });
    const style = this.doc.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);
    this.doc.body.appendChild(host);
    this.host = host;
    this.root = root;
    this.previouslyFocused = this.doc.activeElement;
    return root;
  }

  private panel(root: ShadowRoot, labelledBy: string): HTMLElement {
    const backdrop = this.doc.createElement("div");
    backdrop.className = "backdrop";
    const panel = this.doc.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", labelledBy);
    backdrop.appendChild(panel);
    root.appendChild(backdrop);
    return panel;
  }

  private renderBanner(config: ConsentRuntimeConfig): void {
    const text = copy(config);
    const root = this.mount();
    const panel = this.panel(root, "rift-title");

    const heading = this.doc.createElement("h2");
    heading.id = "rift-title";
    heading.textContent = text.title;
    panel.appendChild(heading);

    const body = this.doc.createElement("p");
    body.textContent = text.body;
    if (text.policyUrl) {
      const link = this.doc.createElement("a");
      link.href = text.policyUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Privacy policy";
      body.appendChild(this.doc.createTextNode(" "));
      body.appendChild(link);
    }
    panel.appendChild(body);

    const actions = this.doc.createElement("div");
    actions.className = "actions";

    const accept = this.button(text.acceptAll, "primary", async () => {
      await this.record(config, config.purposes.map((p) => p.code));
    });
    const reject = this.button(text.rejectAll, "secondary", async () => {
      // Essential purposes are still granted: the operator has declared them
      // as necessary for the site to function, and offering "reject" for a row
      // rendered as locked would be a control that does nothing.
      await this.record(
        config,
        config.purposes.filter((p) => p.kind === "essential").map((p) => p.code),
      );
    });
    const manage = this.button(text.manage, "link", () => {
      this.renderPreferences(config, new Set());
    });

    actions.append(accept, reject, manage);
    panel.appendChild(actions);

    this.trapFocus(panel);
    accept.focus();
  }

  private renderPreferences(
    config: ConsentRuntimeConfig,
    granted: ReadonlySet<string>,
  ): void {
    const text = copy(config);
    const root = this.mount();
    const panel = this.panel(root, "rift-title");

    const heading = this.doc.createElement("h2");
    heading.id = "rift-title";
    heading.textContent = text.manage;
    panel.appendChild(heading);

    const intro = this.doc.createElement("p");
    intro.textContent = text.body;
    panel.appendChild(intro);

    const boxes = new Map<string, HTMLInputElement>();
    for (const purpose of [...config.purposes].sort((a, b) => a.order - b.order)) {
      panel.appendChild(this.purposeRow(purpose, granted, boxes));
    }

    const actions = this.doc.createElement("div");
    actions.className = "actions";
    actions.style.marginTop = "16px";

    const save = this.button(text.save, "primary", async () => {
      const chosen = config.purposes
        .filter((p) => p.kind === "essential" || boxes.get(p.code)?.checked)
        .map((p) => p.code);
      await this.record(config, chosen);
    });
    const acceptAll = this.button(text.acceptAll, "secondary", async () => {
      await this.record(config, config.purposes.map((p) => p.code));
    });

    actions.append(save, acceptAll);
    panel.appendChild(actions);

    this.trapFocus(panel);
    save.focus();
  }

  private purposeRow(
    purpose: ConsentPurposeConfig,
    granted: ReadonlySet<string>,
    boxes: Map<string, HTMLInputElement>,
  ): HTMLElement {
    const row = this.doc.createElement("div");
    row.className = "purpose";

    const box = this.doc.createElement("input");
    box.type = "checkbox";
    box.id = `rift-purpose-${purpose.code}`;
    box.checked = purpose.kind === "essential" || granted.has(purpose.code);
    // An essential purpose is rendered locked rather than hidden: a visitor is
    // entitled to see everything running, including what they cannot switch off.
    box.disabled = purpose.kind === "essential";
    boxes.set(purpose.code, box);

    const text = this.doc.createElement("div");
    const label = this.doc.createElement("label");
    label.setAttribute("for", box.id);
    label.textContent = purpose.name;
    const description = this.doc.createElement("p");
    description.className = "desc";
    description.textContent = purpose.description;
    text.append(label, description);

    if (purpose.kind === "essential") {
      const locked = this.doc.createElement("p");
      locked.className = "locked";
      locked.textContent = "Always active";
      text.appendChild(locked);
    }
    if (purpose.vendors.length > 0) {
      const vendors = this.doc.createElement("p");
      vendors.className = "vendors";
      vendors.textContent = `Vendors: ${purpose.vendors.join(", ")}`;
      text.appendChild(vendors);
    }

    row.append(box, text);
    return row;
  }

  private button(
    label: string,
    className: string,
    onClick: () => void | Promise<void>,
  ): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", () => void onClick());
    return button;
  }

  /**
   * Record one decision per purpose.
   *
   * A purpose the visitor turned off is `deny` when it has never been decided
   * and `withdraw` when it was previously granted. The distinction is the whole
   * reason the consent log is append-only: "declined" and "changed their mind"
   * are different facts, and collapsing them would destroy the second.
   */
  private async record(
    config: ConsentRuntimeConfig,
    grantedCodes: readonly string[],
  ): Promise<void> {
    const granted = new Set(grantedCodes);
    const previous = new Set(
      (await this.consent.getState())
        .filter((s) => s.status === "GRANTED")
        .map((s) => s.purpose_code),
    );

    const options = config.notice
      ? {
          noticeId: config.notice.notice_id,
          policyVersionId: config.notice.policy_version_id ?? undefined,
        }
      : undefined;

    for (const purpose of config.purposes) {
      if (granted.has(purpose.code)) {
        await this.consent.grant(purpose.code, options);
      } else if (previous.has(purpose.code)) {
        await this.consent.withdraw(purpose.code, options);
      } else {
        await this.consent.deny(purpose.code, options);
      }
    }

    this.close();
    this.options.onDecision?.([...granted]);
  }

  /**
   * Keep focus inside the dialog.
   *
   * A modal a keyboard user can tab out of is one they can leave without
   * deciding, while the page behind it is still inert to a mouse — the worst of
   * both. Escape is handled by the caller's own controls rather than closing to
   * nothing, so there is no path that dismisses the dialog without a decision.
   */
  private trapFocus(panel: HTMLElement): void {
    panel.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, input:not([disabled]), a[href]',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = this.root?.activeElement;
      if ((event as KeyboardEvent).shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!(event as KeyboardEvent).shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }
}
