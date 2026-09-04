import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  ConsentPolicyVersionListResponse,
  RecommendedPolicyResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, apiSend } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";

/**
 * The consent policy review screen.
 *
 * Phase 9A's six columns: what was detected, the category recommended for it,
 * the rule that applies, the action recommended, the owner's override, and the
 * status of the line. Then one button that publishes an immutable version.
 *
 * ## Nothing here is live until it is approved
 *
 * The table is generated on every load from the latest completed scan, the
 * markets the operator selected and the requirement matrix. It is not stored.
 * What is stored is what somebody approved, and the banner reads that.
 *
 * ## "Block" is advice
 *
 * The word appears in this table and it means *we suggest you do not load this
 * until the purpose is granted*. Rift does not block anything: the runtime
 * renders a banner and records decisions, and whether a tag actually loads is
 * decided by the customer's own integration. Saying `block` in a product that
 * silently does not block would be the worst kind of reassurance, so the screen
 * says which it is.
 */

async function saveOverride(formData: FormData) {
  "use server";

  const siteId = String(formData.get("site_id") ?? "");
  const detectorId = String(formData.get("detector_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const purposeCode = String(formData.get("purpose_code") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const back = `/dashboard/policy${buildQuery({ site_id: siteId })}`;

  if (action === "__clear") {
    await apiSend(
      `/api/v1/sites/${siteId}/consent-policy/overrides?detector_id=${encodeURIComponent(detectorId)}`,
      { method: "DELETE" },
    );
  } else {
    await apiSend(`/api/v1/sites/${siteId}/consent-policy/overrides`, {
      method: "POST",
      body: {
        detector_id: detectorId,
        action,
        purpose_code: purposeCode || null,
        note: note || null,
      },
    });
  }

  revalidatePath("/dashboard/policy");
  redirect(back);
}

async function approve(formData: FormData) {
  "use server";

  const siteId = String(formData.get("site_id") ?? "");
  const payload = String(formData.get("payload") ?? "{}");
  const note = String(formData.get("approval_note") ?? "").trim();

  const parsed = JSON.parse(payload) as {
    recommendations: unknown[];
    jurisdictions: string[];
    regimes: string[];
    scan_id: string | null;
  };

  const result = await apiSend(`/api/v1/sites/${siteId}/consent-policy`, {
    method: "POST",
    body: { ...parsed, approval_note: note || null },
  });

  revalidatePath("/dashboard/policy");
  redirect(
    `/dashboard/policy${buildQuery({ site_id: siteId })}${siteId ? "&" : "?"}${
      result.ok ? "approved=1" : `error=${encodeURIComponent(result.message)}`
    }`,
  );
}

const ACTIONS = ["allow", "require_consent", "block", "ignore", "review"] as const;

const ACTION_HELP: Record<string, string> = {
  allow: "No consent gate suggested.",
  require_consent: "Load only once the purpose is granted.",
  block: "Suggest not loading it until you decide otherwise.",
  ignore: "Out of scope. Removes it from the preference centre listing only.",
  review: "The inputs do not support a recommendation.",
};

export default async function PolicyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const markets = (Array.isArray(params.market)
    ? params.market
    : params.market
      ? [params.market]
      : ["DE"]) as string[];
  const error = readFilter(params, "error");
  const approved = readFilter(params, "approved");

  const sites = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  if (!sites.ok) {
    return <ErrorState title="Could not load websites" message={sites.message} />;
  }

  const selected =
    sites.data.sites.find((s) => s.site_id === siteId) ?? sites.data.sites[0] ?? null;

  if (!selected) {
    return (
      <>
        <PageHeader
          title="Consent policy"
          description="Review what Rift recommends, change what you disagree with, then approve."
        />
        <EmptyState title="No websites yet" hint="Add one under Websites." />
      </>
    );
  }

  const query = markets.map((m) => `market=${encodeURIComponent(m)}`).join("&");
  const [policyResult, versionsResult] = await Promise.all([
    apiGet<RecommendedPolicyResponse>(
      `/api/v1/sites/${selected.site_id}/consent-policy?${query}`,
    ),
    apiGet<ConsentPolicyVersionListResponse>(
      `/api/v1/sites/${selected.site_id}/consent-policy?versions=true`,
    ),
  ]);

  if (!policyResult.ok) {
    return <ErrorState title="Could not generate a policy" message={policyResult.message} />;
  }

  const { policy, active_version: active } = policyResult.data;
  const versions = versionsResult.ok ? versionsResult.data.versions : [];

  return (
    <>
      <PageHeader
        title="Consent policy"
        description="Generated from your latest scan and the markets you serve. Nothing here is live until you approve it."
      />

      <FilterBar action="/dashboard/policy">
        <SiteFilter sites={sites.data.sites} value={selected.site_id} />
      </FilterBar>

      {error ? <ErrorState title="That did not work" message={error} /> : null}
      {approved ? (
        <Section>
          <div className="card">
            <p style={{ margin: 0 }}>
              <StatusBadge status="approved" /> Published. The banner will pick it
              up within a minute.
            </p>
          </div>
        </Section>
      ) : null}

      <Section title="Status">
        <div className="card">
          <p style={{ margin: "0 0 8px" }}>
            {active ? (
              <>
                <StatusBadge status="approved" /> Version {active.version} is live,
                approved {new Date(active.approved_at ?? active.created_at).toUTCString()}.
              </>
            ) : (
              <>
                <StatusBadge status="draft" /> Nothing approved yet. The banner is
                serving your declared purposes with no vendor list.
              </>
            )}
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Markets: {policy.jurisdictions.join(", ") || "none selected"} ·
            Regimes considered: {policy.regimes.join(", ") || "none"}
          </p>
          {policy.undeclared_purposes.length > 0 ? (
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
              These purposes are referenced below but not declared yet:{" "}
              <strong>{policy.undeclared_purposes.join(", ")}</strong>. Declare
              them under{" "}
              <a href={`/dashboard/configure${buildQuery({ site_id: selected.site_id })}`}>
                Configure
              </a>{" "}
              — a banner cannot record a decision against a purpose that does not
              exist.
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Recommendations">
        {policy.recommendations.length === 0 ? (
          <EmptyState
            title="Nothing detected yet"
            hint="Run a scan under Scans. Recommendations are generated from what it finds."
          />
        ) : (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Detected</th>
                    <th>Recommended category</th>
                    <th>Applicable rule</th>
                    <th>Recommended action</th>
                    <th>Owner override</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {policy.recommendations.map((r) => (
                    <tr key={r.detector_id}>
                      <td>
                        <strong>{r.vendor_name}</strong>
                        <div style={{ fontSize: 12, color: "var(--muted, #5a626b)" }}>
                          {r.category}
                          {r.observed_in_latest_scan ? null : " · not in the latest scan"}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {r.suggested_purpose ?? <em>none</em>}
                        {r.data_categories.length ? (
                          <div style={{ fontSize: 12, color: "var(--muted, #5a626b)" }}>
                            {r.data_categories.join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.rule_references.length ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>
                              {r.rule_references.length} rule
                              {r.rule_references.length === 1 ? "" : "s"}
                            </summary>
                            <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                              {r.rule_references.map((id) => (
                                <li key={id}>{id}</li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <em>none</em>
                        )}
                        <div style={{ marginTop: 4, color: "var(--muted, #5a626b)" }}>
                          consent: {r.consent_requirement} · opt-out:{" "}
                          {r.opt_out_requirement}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.recommended_action} />
                        <div style={{ fontSize: 12, color: "var(--muted, #5a626b)", marginTop: 4 }}>
                          {r.reason}
                        </div>
                      </td>
                      <td>
                        <form action={saveOverride}>
                          <input type="hidden" name="site_id" value={selected.site_id} />
                          <input type="hidden" name="detector_id" value={r.detector_id} />
                          <select name="action" defaultValue={r.overridden ? r.recommended_action : ""} aria-label={`Override for ${r.vendor_name}`}>
                            <option value="">— use recommendation —</option>
                            {ACTIONS.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                            {r.overridden ? <option value="__clear">clear override</option> : null}
                          </select>
                          <input
                            type="text"
                            name="purpose_code"
                            placeholder="purpose"
                            defaultValue={r.overridden ? (r.suggested_purpose ?? "") : ""}
                            style={{ width: 110, marginTop: 4 }}
                            aria-label={`Purpose for ${r.vendor_name}`}
                          />
                          <input
                            type="text"
                            name="note"
                            placeholder="why"
                            defaultValue={r.override_note ?? ""}
                            style={{ width: 140, marginTop: 4 }}
                            aria-label={`Reason for ${r.vendor_name}`}
                          />
                          <button type="submit" className="button" style={{ marginTop: 4 }}>
                            Save
                          </button>
                        </form>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {r.overridden ? "Overridden" : "Recommended"}
                        <div style={{ fontSize: 12, color: "var(--muted, #5a626b)" }}>
                          {r.confidence} confidence
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <div className="card" style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                <strong>What these actions mean.</strong> Rift does not block
                anything — the runtime shows a banner and records decisions, and
                whether a tag loads is decided by your own integration.
              </p>
              <ul style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                {ACTIONS.map((a) => (
                  <li key={a}>
                    <code>{a}</code> — {ACTION_HELP[a]}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Section>

      {policy.open_questions.length > 0 ? (
        <Section title="What this cannot decide for you">
          <div className="card">
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>
              {policy.open_questions.length} questions the requirement matrix does
              not answer. They are listed rather than hidden: a recommendation
              that looked settled while resting on these would be worse than one
              that says so.
            </p>
            <ul style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              {policy.open_questions.slice(0, 15).map((q, i) => (
                <li key={`${q.reason}-${i}`}>{q.detail}</li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      <Section title="Approve">
        <div className="card">
          <p style={{ margin: "0 0 12px", fontSize: 13 }}>
            Approving publishes an immutable version and makes it available to the
            runtime. It records what you agreed to, so a consent decision recorded
            afterwards can cite the configuration that was actually being served.
          </p>
          <form action={approve}>
            <input type="hidden" name="site_id" value={selected.site_id} />
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify({
                recommendations: policy.recommendations,
                jurisdictions: policy.jurisdictions,
                regimes: policy.regimes,
                scan_id: policy.scan_id,
              })}
            />
            <input
              type="text"
              name="approval_note"
              placeholder="Note (optional) — who approved this and why"
              style={{ width: "min(420px, 100%)", marginRight: 8 }}
              aria-label="Approval note"
            />
            <button type="submit" className="primary">
              Approve and publish
            </button>
          </form>
        </div>
      </Section>

      {versions.length > 0 ? (
        <Section title="Published versions">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Approved</th>
                  <th>Vendors</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.policy_version_id}>
                    <td>{v.version}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {v.approved_at ? new Date(v.approved_at).toUTCString() : "—"}
                    </td>
                    <td style={{ fontSize: 13 }}>{v.recommendations.length}</td>
                    <td style={{ fontSize: 13 }}>{v.approval_note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}
