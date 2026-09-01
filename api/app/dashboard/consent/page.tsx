import type {
  ConsentHistoryResponse,
  ConsentStateResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, type ApiResult } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { formatDateTime, shortId } from "../_components/format";
import { buildQuery, FilterBar, readFilter, SiteFilter, TextFilter } from "../_components/filters";

/** Enough history to answer a question about one principal without paging. */
const HISTORY_LIMIT = 200;

export default async function ConsentPage({ searchParams }: PageProps<"/dashboard/consent">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const principalId = readFilter(params, "principal_external_id");
  const purposeCode = readFilter(params, "purpose_code");

  // Effective consent is only meaningful for a named principal on a named site,
  // so it is only requested once both filters are set.
  const wantsEffective = Boolean(siteId && principalId);

  const [sites, history, effective] = await Promise.all([
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<ConsentHistoryResponse>(
      `/api/v1/consent/history${buildQuery({
        site_id: siteId,
        principal_external_id: principalId,
        purpose_code: purposeCode,
        limit: HISTORY_LIMIT,
      })}`,
    ),
    wantsEffective
      ? apiGet<ConsentStateResponse>(
          `/api/v1/consent/effective${buildQuery({
            site_id: siteId,
            principal_external_id: principalId,
          })}`,
        )
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Consent"
        description="The decision log: who agreed to what, under which notice, and when. The log is append-only — withdrawing consent adds a row, it never edits or deletes the grant that came before it."
      />

      <FilterBar action="/dashboard/consent">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={siteId} /> : null}
        <TextFilter
          name="principal_external_id"
          label="Principal id"
          value={principalId}
          placeholder="anon_…"
        />
        <TextFilter name="purpose_code" label="Purpose" value={purposeCode} placeholder="analytics" />
      </FilterBar>

      {sites.ok ? null : (
        <ErrorState title="Site list could not be loaded" message={sites.message} />
      )}

      {principalId ? (
        <Section title="Current effective consent">
          <EffectiveConsent state={effective} siteId={siteId} />
        </Section>
      ) : null}

      <Section title="Decision history">
        {!history.ok ? (
          <ErrorState title="History could not be loaded" message={history.message} />
        ) : history.data.records.length === 0 ? (
          <EmptyState
            title="No consent decisions match these filters"
            hint="Every grant, denial and withdrawal recorded through the SDK or the consent API appears here. Clear the filters, or record a decision, to see rows."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Decided</th>
                  <th>Recorded</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Principal</th>
                  <th>Notice</th>
                  <th>Policy version</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {history.data.records.map((record) => (
                  <tr key={record.consent_record_id}>
                    <td>{formatDateTime(record.decided_at)}</td>
                    <td>{formatDateTime(record.recorded_at)}</td>
                    <td className="mono">{record.purpose_code}</td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="mono" title={record.principal_external_id}>
                      {shortId(record.principal_external_id)}
                    </td>
                    <td className="mono" title={record.notice_id ?? undefined}>
                      {shortId(record.notice_id)}
                    </td>
                    <td className="mono" title={record.policy_version_id ?? undefined}>
                      {shortId(record.policy_version_id)}
                    </td>
                    <td>{record.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}

/**
 * Effective consent, as the platform computes it.
 *
 * Fetched from `/api/v1/consent/effective` rather than re-derived from the
 * history table on this page: history is paginated, so reducing whatever page
 * happened to load would give a silently wrong answer for a principal with a
 * long decision log. The endpoint reduces the whole log, through the same shared
 * `resolveEffectiveConsent` the browser plane and the SDK use.
 *
 * Consent is per site — the same principal id can hold different decisions on
 * two sites — so this asks for a site rather than guessing.
 */
function EffectiveConsent({
  state,
  siteId,
}: {
  state: ApiResult<ConsentStateResponse> | null;
  siteId: string | undefined;
}) {
  if (!siteId || state === null) {
    return (
      <EmptyState
        title="Select a site"
        hint="Consent is recorded per site, so the same principal id can hold different decisions on each. Choose a site above to see the decisions currently in force."
      />
    );
  }

  if (!state.ok) {
    return <ErrorState title="Effective consent could not be loaded" message={state.message} />;
  }

  const effective = state.data.purposes;


  if (effective.length === 0) {
    return (
      <EmptyState
        title="No decisions for this principal"
        hint="Nothing is in force. Absence of a decision is not permission — processing is not authorised for any purpose."
      />
    );
  }

  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Status</th>
            <th>Decided</th>
            <th>Notice</th>
            <th>Policy version</th>
          </tr>
        </thead>
        <tbody>
          {effective.map((entry) => (
            <tr key={entry.purpose_code}>
              <td className="mono">{entry.purpose_code}</td>
              <td>
                <StatusBadge status={entry.status} />
              </td>
              <td>{formatDateTime(entry.decided_at)}</td>
              <td className="mono" title={entry.notice_id ?? undefined}>
                {shortId(entry.notice_id)}
              </td>
              <td className="mono" title={entry.policy_version_id ?? undefined}>
                {shortId(entry.policy_version_id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
