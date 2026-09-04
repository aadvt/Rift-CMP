import type {
  ConsentRuntimeConfig,
  PurposeSummary,
  RecommendedPolicyResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, requestOrigin } from "@/lib/dashboard/api";
import { EmptyState, ErrorState, PageHeader, Section, StatusBadge } from "../_components/ui";
import { FilterBar, SiteFilter, readFilter } from "../_components/filters";
import { ConsentPreview } from "../_components/consent-preview";
import { NotYetAvailable } from "../_components/journey";

/**
 * Consent experience: what a visitor to this site actually sees.
 *
 * Deliberately a short screen. Phase 11's rule is automation first, human review
 * second, manual configuration third — so this reports the configuration Rift
 * generated and lets an operator look at it through a visitor's eyes. It is not
 * a consent-management wizard, and turning it into one would undo the point of
 * the setup journey.
 *
 * ## Why the configuration is read-only here
 *
 * Everything on this page is derived: the purposes come from what the operator
 * declared, the vendors from what the scan found, the enforcement mode from the
 * approved policy version. The place to change any of it is the place that owns
 * it — Configure for purposes, Setup for the policy. A second set of controls
 * here would be a second source of truth, and the two would disagree.
 *
 * ## What the runtime configuration deliberately does not contain
 *
 * No regime, no jurisdiction, no citation, no requirement. `ConsentRuntimeConfig`
 * is inert by design: a banner that decided anything would put legal reasoning
 * into a bundle that ships to every visitor and can be read and rewritten by
 * anyone. Everything that needed deciding was decided server-side before this
 * was serialised, which is why this page shows labels and ordering and nothing
 * that looks like a verdict.
 */

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  essential: "Always on",
  optional: "Visitor chooses",
};

export default async function ConsentExperiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");

  const sitesResult = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  if (!sitesResult.ok) {
    return <ErrorState title="Could not load your websites" message={sitesResult.message} />;
  }

  const sites = sitesResult.data.sites;
  const site = sites.find((s) => s.site_id === siteId) ?? sites[0] ?? null;

  if (!site) {
    return (
      <>
        <PageHeader
          title="Consent experience"
          description="What a visitor to your site sees, and what it records."
        />
        <EmptyState
          title="No websites yet"
          hint="Add one under Setup and Rift will prepare a consent experience for it."
        />
      </>
    );
  }

  const origin = await requestOrigin();

  // The runtime configuration is the browser plane's own contract, authorised by
  // the site's public key rather than the organisation secret. Fetching it here
  // means the preview shows precisely the bytes a visitor's browser receives,
  // rather than a dashboard-side reconstruction of them.
  const [configResponse, purposesResult, policyResult] = await Promise.all([
    fetch(`${origin}/api/v1/consent/config`, {
      headers: { authorization: `Bearer ${site.public_key}` },
      cache: "no-store",
    })
      .then(async (r) => (r.ok ? ((await r.json()) as ConsentRuntimeConfig) : null))
      .catch(() => null),
    apiGet<{ purposes: PurposeSummary[] }>("/api/v1/purposes"),
    apiGet<RecommendedPolicyResponse>(`/api/v1/sites/${site.site_id}/consent-policy`),
  ]);

  const config = configResponse && configResponse.ready === true ? configResponse : null;
  const declared = purposesResult.ok ? purposesResult.data.purposes.filter((p) => p.is_active) : [];
  const activeVersion = policyResult.ok ? policyResult.data.active_version : null;
  const undeclared = policyResult.ok ? policyResult.data.policy.undeclared_purposes : [];

  return (
    <>
      <PageHeader
        title="Consent experience"
        description="What a visitor to your site sees, and what it records."
      />

      <FilterBar action="/dashboard/consent-experience">
        <SiteFilter sites={sites} value={site.site_id} />
      </FilterBar>

      <Section title="Configuration">
        <div className="card">
          <dl className="recommendation-facts">
            <dt>Banner</dt>
            <dd>
              {config ? (
                <StatusBadge status="enabled" />
              ) : (
                <StatusBadge status="not ready" />
              )}
            </dd>
            <dt>Categories</dt>
            <dd>
              {config && config.purposes.length > 0
                ? config.purposes.map((p) => p.name).join(", ")
                : "None yet"}
            </dd>
            <dt>Preference centre</dt>
            <dd>
              {config && config.purposes.some((p) => p.kind === "optional")
                ? "Enabled — visitors can change their mind at any time"
                : "Nothing for a visitor to choose between yet"}
            </dd>
            <dt>Consent records</dt>
            <dd>
              Enabled — every decision is appended to a log that cannot be edited
              or deleted
            </dd>
            <dt>Approved policy</dt>
            <dd>
              {activeVersion
                ? `Version ${activeVersion.version}, approved ${new Date(
                    activeVersion.approved_at ?? activeVersion.created_at,
                  ).toLocaleDateString()}`
                : "None yet — accept a configuration under Setup"}
            </dd>
            <dt>Enforcement</dt>
            <dd>
              {config?.enforcement?.mode
                ? config.enforcement.mode === "enforce"
                  ? "Enforcing — matching third parties are blocked until consent"
                  : config.enforcement.mode === "observe"
                    ? "Observing — Rift reports what it would block, and blocks nothing"
                    : "Off"
                : "Off"}
            </dd>
          </dl>
        </div>
      </Section>

      <Section title="What visitors are asked">
        {!config || config.purposes.length === 0 ? (
          <EmptyState
            title="No purposes to show a visitor"
            hint="Rift will not render a banner that records nothing. Declare a purpose under Configure and one appears here."
          />
        ) : (
          <div className="card">
            <ul className="purpose-rows">
              {config.purposes.map((p) => (
                <li key={p.code}>
                  <p className="row-between">
                    <strong>{p.name}</strong>
                    <StatusBadge status={KIND_LABEL[p.kind] ?? p.kind} />
                  </p>
                  <p className="small">{p.description}</p>
                  {p.vendors.length > 0 ? (
                    <p className="chips">
                      {p.vendors.map((v) => (
                        <span className="chip" key={v}>
                          {v}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="small">
              A purpose marked always-on is a claim you are making about your own
              processing, not a determination Rift made for you.
            </p>
          </div>
        )}
      </Section>

      {undeclared.length > 0 ? (
        <Section title="Your decision is still needed">
          <div className="card review-card">
            <p className="note-title">
              {undeclared.length} purpose{undeclared.length === 1 ? "" : "s"} referenced
              by your configuration {undeclared.length === 1 ? "is" : "are"} not declared
            </p>
            <p className="small">
              Rift found the technologies and proposed where they belong, but it
              will not declare a purpose on your behalf. A purpose describes your
              processing in your words, so a guessed one would read as your
              statement while being Rift&apos;s invention — confident, unauditable
              and often wrong.
            </p>
            <p className="chips">
              {undeclared.map((code) => (
                <span className="chip" key={code}>
                  {code}
                </span>
              ))}
            </p>
            <p className="small">
              Declare {undeclared.length === 1 ? "it" : "them"} on{" "}
              <a href={`/dashboard/configure?site_id=${site.site_id}`}>Configure</a>, and{" "}
              {undeclared.length === 1 ? "it" : "they"} will appear in the banner below.
            </p>
          </div>
        </Section>
      ) : null}

      <Section title="Preview">
        <ConsentPreview config={config} />
      </Section>

      <Section title="Appearance">
        <NotYetAvailable title="The banner's appearance is not configurable yet">
          <p>
            The banner inherits the visitor&apos;s light or dark preference and
            respects reduced-motion, and its text comes from the notice you
            declared. There is no theming contract behind it — no colours, fonts
            or placement are stored anywhere — so there is nothing here to change
            without inventing a setting the runtime would ignore.
          </p>
        </NotYetAvailable>
      </Section>

      <Section title="Declared purposes">
        {declared.length === 0 ? (
          <EmptyState
            title="No purposes declared"
            hint="Purposes are yours to write. Configure is where they live."
          />
        ) : (
          <div className="card">
            <ul className="purpose-rows">
              {declared.map((p) => (
                <li key={p.code}>
                  <p className="row-between">
                    <strong>{p.name}</strong>
                    <span className="mono small">{p.code}</span>
                  </p>
                  <p className="small">{p.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
