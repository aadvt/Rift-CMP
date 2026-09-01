import type {
  TransferAuthorisationSummary,
  TransferRecordSummary,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { formatCount, formatDateTime, shortId } from "../_components/format";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";

export default async function TransfersPage({ searchParams }: PageProps<"/dashboard/transfers">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const query = buildQuery({ site_id: siteId });

  const [sites, authorisations, transfers] = await Promise.all([
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<{ authorisations: TransferAuthorisationSummary[] }>(`/api/v1/authorisations${query}`),
    apiGet<{ transfers: TransferRecordSummary[] }>(`/api/v1/transfers${query}`),
  ]);

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Single-use permissions to send data to a recipient, and the sealed transfers that spent them. Each authorisation names the exact consent decision it relied on."
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <strong>Payload contents are never shown here, because Rift cannot read them.</strong>
        <p className="hint" style={{ margin: "4px 0 0" }}>
          A payload is encrypted to the recipient&rsquo;s public key before it reaches this
          platform, and the matching private key never leaves the recipient. Rift stores
          ciphertext, a SHA-256 digest and routing metadata — enough to prove what moved and
          under whose consent, and not enough to read it.
        </p>
      </div>

      <FilterBar action="/dashboard/transfers">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={siteId} /> : null}
      </FilterBar>

      {sites.ok ? null : (
        <ErrorState title="Site list could not be loaded" message={sites.message} />
      )}

      <Section title="Authorisations">
        {!authorisations.ok ? (
          <ErrorState title="Authorisations could not be loaded" message={authorisations.message} />
        ) : authorisations.data.authorisations.length === 0 ? (
          <EmptyState
            title="No authorisations yet"
            hint="An authorisation is minted by POST /api/v1/authorisations, and only when the principal has granted the purpose. Grant a consent decision, then request one, to see a row here."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th>Recipient</th>
                  <th>Principal</th>
                  <th>Consent record</th>
                </tr>
              </thead>
              <tbody>
                {authorisations.data.authorisations.map((authorisation) => (
                  <tr key={authorisation.authorisation_id}>
                    <td>{formatDateTime(authorisation.created_at)}</td>
                    <td>{formatDateTime(authorisation.expires_at)}</td>
                    <td>
                      <StatusBadge status={authorisation.status} />
                    </td>
                    <td className="mono">{authorisation.purpose_code}</td>
                    <td className="mono">{authorisation.recipient_code}</td>
                    <td className="mono" title={authorisation.principal_external_id}>
                      {shortId(authorisation.principal_external_id)}
                    </td>
                    <td className="mono" title={authorisation.consent_record_id}>
                      {shortId(authorisation.consent_record_id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title="Transfers">
        {!transfers.ok ? (
          <ErrorState title="Transfers could not be loaded" message={transfers.message} />
        ) : transfers.data.transfers.length === 0 ? (
          <EmptyState
            title="No transfers recorded yet"
            hint="A transfer appears once a sealed envelope is submitted against an authorisation. Size and digest are shown; the envelope itself is only ever released to the recipient."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Delivered</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th>Recipient</th>
                  <th>Principal</th>
                  <th className="num">Size</th>
                  <th>Digest</th>
                </tr>
              </thead>
              <tbody>
                {transfers.data.transfers.map((transfer) => (
                  <tr key={transfer.transfer_id}>
                    <td>{formatDateTime(transfer.recorded_at)}</td>
                    <td>{formatDateTime(transfer.delivered_at)}</td>
                    <td>
                      <StatusBadge status={transfer.status} />
                    </td>
                    <td className="mono">{transfer.purpose_code}</td>
                    <td className="mono">{transfer.recipient_code}</td>
                    <td className="mono" title={transfer.principal_external_id}>
                      {shortId(transfer.principal_external_id)}
                    </td>
                    <td className="num">{formatCount(transfer.payload_bytes)} bytes</td>
                    <td className="mono" title={transfer.ciphertext_sha256}>
                      {shortId(transfer.ciphertext_sha256)}
                    </td>
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
