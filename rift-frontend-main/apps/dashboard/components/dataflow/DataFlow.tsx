import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, StatBlock } from '@rift/ui';
import type { DataFlowMap } from '@/lib/api/types';

/**
 * Where a site's data actually goes.
 *
 * ## Two halves, deliberately not merged
 *
 * The browser half is what the SDK watched leave a visitor's device: a
 * third-party host, and the country that host is understood to terminate in.
 * The server half is the transfer ledger — payloads released to a registered
 * recipient under an authorisation that named one specific consent record.
 *
 * They are different claims with different evidence, so they are shown as
 * different sections. Merging them into one "data flow" number would average
 * an observation with an authorisation, and only one of those is a fact about
 * what happened.
 *
 * ## Why country leads
 *
 * DPDP treats a transfer outside India as a distinct question, so "where is
 * this going" needs a geographic answer and not only a vendor name. Unknown is
 * its own bucket, sorted last: folding it into domestic would be the flattering
 * guess rather than the true one.
 */

const REGION_NAMES: Record<string, string> = {
  US: 'United States', IN: 'India', DE: 'Germany', SG: 'Singapore', MT: 'Malta',
  IE: 'Ireland', GB: 'United Kingdom', FR: 'France', NL: 'Netherlands', AU: 'Australia',
};

function countryLabel(code: string | null) {
  if (code === null) return 'Destination unknown';
  return REGION_NAMES[code] ? `${REGION_NAMES[code]} (${code})` : code;
}

export function DataFlow({ map }: { map: DataFlowMap }) {
  const hasBrowser = map.browserDestinations.length > 0;
  const hasTransfers = map.serverTransfers.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-0">
          <StatBlock label="Destinations" value={map.totals.destinations} meta="Third-party hosts contacted" className="lg:pr-6" />
          <StatBlock label="Countries" value={map.totals.countries} meta="Where those hosts terminate" className="lg:border-l lg:border-md-outline-variant lg:px-6" />
          <StatBlock
            label="Cross-border"
            value={map.totals.crossBorder}
            meta={<span className={map.totals.crossBorder > 0 ? 'text-md-on-surface-variant' : undefined}>Leaving India</span>}
            className="lg:border-l lg:border-md-outline-variant lg:px-6"
          />
          <StatBlock label="Server transfers" value={map.totals.transfers} meta="Under a consent authorisation" className="lg:border-l lg:border-md-outline-variant lg:pl-6" />
        </CardBody>
      </Card>

      {/* ── Browser half ─────────────────────────────────────────────────── */}
      <Card>
        <CardBody>
          <CardHeader
            title="Leaving the browser"
            sub="Third-party destinations the Rift SDK observed on real page views, grouped by where each one terminates."
          />

          {!hasBrowser ? (
            <EmptyState
              icon="sites"
              title="Nothing observed yet"
              body="Once the Rift snippet is live and visitors arrive, every third-party destination they contact appears here with the country it resolves to."
            />
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {map.byCountry.map((group) => (
                <li
                  key={group.country ?? '__unknown'}
                  className="overflow-hidden rounded-3xl border border-md-outline-variant"
                >
                  <div className="flex flex-wrap items-center gap-3 bg-md-surface-container-low px-5 py-4">
                    <span className="text-title-large font-normal text-md-on-surface">
                      {countryLabel(group.country)}
                    </span>
                    {group.country === null ? (
                      <Chip tone="neutral">Not in the catalogue</Chip>
                    ) : group.crossesBorder ? (
                      <Chip tone="warning">Cross-border</Chip>
                    ) : (
                      <Chip tone="success">Domestic</Chip>
                    )}
                    <span className="ml-auto text-label-medium tabular-nums text-md-on-surface-variant">
                      {group.requestCount.toLocaleString('en-US')} requests ·{' '}
                      {group.destinations.length} host{group.destinations.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ul className="divide-y divide-md-outline-variant">
                    {group.destinations.map((d) => (
                      <li key={d.host} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-body-small text-md-on-surface">
                            {d.host}
                          </span>
                          <span className="mt-0.5 block text-label-small text-md-on-surface-variant">
                            {d.vendor ?? 'Vendor not identified'}
                            {d.category ? ` · ${d.category}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-label-medium tabular-nums text-md-on-surface-variant">
                          {d.requestCount.toLocaleString('en-US')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ── Server half ──────────────────────────────────────────────────── */}
      <Card>
        <CardBody>
          <CardHeader
            title="Leaving the server"
            sub="Payloads released to a registered recipient. Each one names the consent record that authorised it."
          />

          {!hasTransfers ? (
            <EmptyState
              icon="layers"
              title="No transfers recorded"
              body="When your systems release data to a recipient through Rift, each transfer is logged here with the consent decision it relied on — and Rift never sees the payload itself."
            />
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    {['Recipient', 'Purpose', 'Authorised by', 'Size', 'Status', 'Recorded'].map((h, i) => (
                      <th
                        key={h}
                        className={`h-12 border-b border-md-outline-variant px-4 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant ${i > 2 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {map.serverTransfers.map((t) => (
                    <tr key={t.transferId} className="transition-colors duration-[--md-duration-fast] hover:bg-md-primary/5">
                      <td className="border-b border-md-outline-variant px-4 py-3.5">
                        <span className="block text-label-medium font-medium text-md-on-surface">
                          {t.recipientName ?? t.recipientCode}
                        </span>
                        <span className="block font-mono text-label-small text-md-on-surface-variant">
                          {t.recipientCode}
                        </span>
                      </td>
                      <td className="border-b border-md-outline-variant px-4 py-3.5 text-body-small text-md-on-surface-variant">
                        {t.purposeCode}
                      </td>
                      <td className="border-b border-md-outline-variant px-4 py-3.5">
                        {/* The specific decision, not a general permission. */}
                        <span className="font-mono text-label-small text-md-on-surface-variant">
                          {t.consentRecordId}
                        </span>
                      </td>
                      <td className="border-b border-md-outline-variant px-4 py-3.5 text-right text-body-small tabular-nums text-md-on-surface-variant">
                        {(t.payloadBytes / 1024).toFixed(1)} kB
                      </td>
                      <td className="border-b border-md-outline-variant px-4 py-3.5 text-right">
                        {t.status === 'DELIVERED' ? (
                          <Chip tone="success" glyph="check">Delivered</Chip>
                        ) : t.status === 'FAILED' ? (
                          <Chip tone="error">Failed</Chip>
                        ) : (
                          <Chip tone="neutral">Recorded</Chip>
                        )}
                      </td>
                      <td className="border-b border-md-outline-variant px-4 py-3.5 text-right text-body-small tabular-nums text-md-on-surface-variant">
                        {new Date(t.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-5 flex gap-3 border-t border-md-outline-variant pt-4 text-body-small leading-relaxed text-md-on-surface-variant">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <span>
              Rift records that a transfer happened and which consent authorised it. The payload is
              sealed to the recipient&rsquo;s public key before it reaches us, so what was sent is
              something only they can read.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
