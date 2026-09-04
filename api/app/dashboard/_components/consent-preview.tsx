"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsentRuntimeConfig, EffectiveConsent } from "@rift-cmp/shared";
// Imported from source rather than from the package entry point: the SDK is
// built as an IIFE for a <script> tag and exposes no ES module, so there is
// nothing to import from "@rift-cmp/sdk". The test suite reaches into
// `sdk/src` the same way, for the same reason.
import type { ConsentApi } from "../../../../sdk/src/consent";
import { ConsentUi } from "../../../../sdk/src/ui";

/**
 * The visitor experience, rendered by the code that renders it for visitors.
 *
 * This is not a mock-up of the banner. It constructs the SDK's own `ConsentUi`
 * with the site's own `ConsentRuntimeConfig`, so the copy, the purpose rows, the
 * locked essential rows, the focus trap, the Escape behaviour and the shadow-root
 * isolation are all the real ones. A drawing of a banner would drift from the
 * banner within a release; this cannot, because there is only one banner.
 *
 * ## Two things are deliberately substituted, and only two
 *
 * **The document.** `ConsentUi` takes a `documentRef`, so it renders inside an
 * iframe rather than over the dashboard. That gives the preview a real viewport
 * to be sized — which is what makes the mobile/desktop toggle meaningful rather
 * than a CSS trick — and keeps a fixed-position banner from covering the page
 * the operator is working on.
 *
 * **The consent store.** The `ConsentApi` handed in records decisions in memory
 * and writes nothing. Using the real `ConsentClient` here would append the
 * operator's preview clicks to the site's consent log as though a visitor had
 * made them. That log is append-only and is the evidence a regulator would ask
 * for; filling it with rehearsals would corrupt the one record that has to stay
 * trustworthy. So the rendering is real and the recording is not, which is the
 * correct way round.
 */

/** A consent store that satisfies the SDK's interface and persists nothing. */
function createPreviewConsentStore(): ConsentApi {
  let state: EffectiveConsent[] = [];
  const listeners = new Set<(s: EffectiveConsent[]) => void>();

  const emit = () => {
    for (const listener of listeners) listener([...state]);
  };

  const put = (purposeCode: string, status: EffectiveConsent["status"]) => {
    state = [
      ...state.filter((s) => s.purpose_code !== purposeCode),
      {
        purpose_code: purposeCode,
        status,
        decided_at: new Date().toISOString(),
        // A preview decision has no record behind it, and the identifier says
        // so rather than borrowing the shape of a real one.
        consent_record_id: "preview",
        notice_id: null,
        policy_version_id: null,
      },
    ];
    emit();
    return Promise.resolve(true);
  };

  return {
    getState: () => Promise.resolve([...state]),
    getCachedState: () => [...state],
    isGranted: (code) => state.some((s) => s.purpose_code === code && s.status === "GRANTED"),
    record: (code, status) => put(code, status),
    grant: (code) => put(code, "GRANTED"),
    deny: (code) => put(code, "DENIED"),
    withdraw: (code) => put(code, "WITHDRAWN"),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // No principal is minted for a preview, and no session token exists. Saying
    // so honestly is better than inventing an identifier the SDK might attach
    // to something.
    getPrincipalId: () => null,
    getSessionToken: () => null,
    clear: () => {
      state = [];
      emit();
    },
  };
}

type Viewport = "desktop" | "mobile";
type Surface = "banner" | "preferences";

const VIEWPORTS: Record<Viewport, { width: number; height: number; label: string }> = {
  desktop: { width: 900, height: 420, label: "Desktop" },
  mobile: { width: 375, height: 560, label: "Mobile" },
};

export function ConsentPreview({ config }: { config: ConsentRuntimeConfig | null }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [surface, setSurface] = useState<Surface>("banner");
  const [decision, setDecision] = useState<string[] | null>(null);

  useEffect(() => {
    if (!config) return;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    // A blank page for the banner to sit on, so what is being judged is the
    // banner and not a screenshot of somebody's marketing site.
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif;` +
        `background:#fff;color:#111}` +
        `@media (prefers-color-scheme:dark){html,body{background:#0f1115;color:#e8eaed}}` +
        `.page{padding:22px;font-size:13px;opacity:.45}</style></head>` +
        `<body><div class="page">Your website</div></body></html>`,
    );
    doc.close();

    setDecision(null);

    const ui = new ConsentUi(createPreviewConsentStore(), {
      // `force` so the banner shows even though the preview store has no
      // decisions yet and would otherwise be re-asked only once.
      apiUrl: "",
      publicKey: "",
      force: true,
      documentRef: doc,
      // The configuration has already been fetched server-side with the
      // organisation's credential. Handing it over directly means the preview
      // never needs a site key in the operator's browser, and never depends on
      // the browser plane being reachable from the dashboard.
      fetchRef: (() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(config),
        })) as unknown as typeof fetch,
      onDecision: (granted) => setDecision(granted),
    });

    void (surface === "preferences" ? ui.showPreferences() : ui.showBannerIfNeeded());

    return () => ui.close();
  }, [config, surface, viewport]);

  if (!config) {
    return (
      <div className="card">
        <p>
          There is no runtime configuration for this site yet, so there is
          nothing for a visitor to see.
        </p>
        <p className="small">
          A configuration appears once purposes are declared. Until then the SDK
          renders nothing at all rather than an empty banner — a consent
          mechanism that records nothing would be worse than none.
        </p>
      </div>
    );
  }

  const size = VIEWPORTS[viewport];

  return (
    <div className="card">
      <div className="preview-controls">
        <div role="group" aria-label="Preview viewport" className="segmented">
          {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewport(key)}
              aria-pressed={viewport === key}
            >
              {VIEWPORTS[key].label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Preview surface" className="segmented">
          <button
            type="button"
            onClick={() => setSurface("banner")}
            aria-pressed={surface === "banner"}
          >
            Banner
          </button>
          <button
            type="button"
            onClick={() => setSurface("preferences")}
            aria-pressed={surface === "preferences"}
          >
            Preference centre
          </button>
        </div>
      </div>

      <div className="preview-stage">
        <iframe
          ref={frameRef}
          title="Visitor consent experience preview"
          className="preview-frame"
          style={{ width: size.width, height: size.height, maxWidth: "100%" }}
        />
      </div>

      <p className="small" role="status">
        {decision
          ? decision.length > 0
            ? `A visitor choosing this would grant: ${decision.join(", ")}.`
            : "A visitor choosing this would grant nothing beyond essential purposes."
          : "This is the real banner, rendered by the SDK. Nothing you click here is recorded."}
      </p>
    </div>
  );
}
