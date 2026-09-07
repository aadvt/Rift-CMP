import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, StatBlock } from '@rift/ui';
import type { DiscoveryInventory } from '@/lib/api/types';

/**
 * What actually ran on the site's pages, watched from inside the browser.
 *
 * ## Why this is not the scanner
 *
 * A crawl visits a URL once, logged out, and sees what loads for a robot. The
 * SDK is already on the page while real people use it, so it catches
 * lazy-loaded tags, logged-in states, and — the part a crawl structurally
 * cannot do — whether a request genuinely left the browser.
 *
 * That last property is the whole point. It turns "we found this tracker" into
 * "this tracker fired while consent was withdrawn", which is evidence rather
 * than an inventory, and it is why violations lead this screen.
 *
 * ## Unclassified is not a violation
 *
 * A host the catalogue does not know is an absence of knowledge, not a finding
 * against the site. It gets the neutral surface, the same way `unresolved` does
 * everywhere else in the product — never the error tone.
 */

const KIND_LABEL: Record<string, string> = {
  cookie: 'Cookie', local_storage: 'Local storage', session_storage: 'Session storage',
};

export function Inventory({ inventory }: { inventory: DiscoveryInventory }) {
  const { totals, violations, components, storage } = inventory;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-0">
          <StatBlock label="Destinations" value={totals.destinations} meta={`${totals.thirdParty} third-party`} className="lg:pr-6" />
          <StatBlock label="Unclassified" value={totals.unclassified} meta="Not in the catalogue yet" className="lg:border-l lg:border-md-outline-variant lg:px-6" />
          <StatBlock label="Cross-border" value={totals.crossBorder} meta="Terminating outside India" className="lg:border-l lg:border-md-outline-variant lg:px-6" />
          <StatBlock label="Storage keys" value={totals.storageItems} meta="Cookies and web storage" className="lg:border-l lg:border-md-outline-variant lg:pl-6" />
        </CardBody>
      </Card>

      {/* ── The claim the feature exists to support ──────────────────────── */}
      <Card className={violations.length > 0 ? 'ring-1 ring-md-error/30' : undefined}>
        <CardBody>
          <CardHeader
            title="Fired against a decision"
            sub="A destination contacted while consent for its purpose was denied or withdrawn."
            action={
              violations.length > 0
                ? <Chip tone="error">{violations.length} open</Chip>
                : <Chip tone="success" glyph="check">None</Chip>
            }
          />

          {violations.length === 0 ? (
            <EmptyState
              icon="check"
              title="Nothing fired against a decision"
              body="Every destination the SDK observed was contacted under a purpose the visitor had allowed. This is the state you want."
            />
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {violations.map((v, i) => (
                <li
                  key={`${v.host}-${v.purposeCode}-${i}`}
                  className="rounded-3xl border border-md-error/30 bg-md-error-container/40 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-body-medium text-md-on-surface">{v.host}</span>
                    <Chip tone="error">{v.consentStatus === 'WITHDRAWN' ? 'Consent withdrawn' : 'Consent denied'}</Chip>
                    <span className="ml-auto text-label-small tabular-nums text-md-on-surface-variant">
                      {new Date(v.observedAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
                    Contacted under <span className="font-medium text-md-on-surface">{v.purposeCode}</span>,
                    which this visitor had not granted at the moment of the request. The consent state
                    at that moment is recorded with the observation — it is not reconstructed later.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ── Everything observed ──────────────────────────────────────────── */}
      <Card>
        <CardBody>
          <CardHeader
            title="Observed destinations"
            sub={`Collected from real page views. Last updated ${new Date(inventory.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
          />

          {components.length === 0 ? (
            <EmptyState
              icon="sites"
              title="Nothing observed yet"
              body="Once the Rift snippet is live and visitors arrive, every destination their browser contacts appears here."
            />
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table
                data-stack
                className="w-full border-collapse"
                style={{ ['--md-table-min' as string]: '820px' } as React.CSSProperties}
              >
                <thead>
                  <tr>
                    {['Host', 'Vendor', 'Where it goes', 'Seen on', 'Requests'].map((h, i) => (
                      <th
                        key={h}
                        className={`h-12 border-b border-md-outline-variant px-4 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant ${i === 4 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <tr key={c.host} className="transition-colors duration-[--md-duration-fast] hover:bg-md-primary/5">
                      <td data-label="Host" className="border-b border-md-outline-variant px-4 py-3.5">
                        <span className="block font-mono text-body-small text-md-on-surface">{c.host}</span>
                        {c.initiator ? (
                          <span className="mt-0.5 block truncate font-mono text-label-small text-md-on-surface-variant">
                            loaded by {c.initiator}
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Vendor" className="border-b border-md-outline-variant px-4 py-3.5">
                        {c.unclassified ? (
                          // Neutral by design: nobody has catalogued this host yet,
                          // which is a task, not a fault.
                          <Chip tone="neutral">Unclassified</Chip>
                        ) : (
                          <>
                            <span className="block text-label-medium font-medium text-md-on-surface">{c.vendor}</span>
                            {c.category ? (
                              <span className="block text-label-small text-md-on-surface-variant">{c.category}</span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td data-label="Where it goes" className="border-b border-md-outline-variant px-4 py-3.5">
                        {c.destinationCountry === null ? (
                          <span className="text-body-small text-md-on-surface-variant">Unknown</span>
                        ) : c.crossesBorder ? (
                          <Chip tone="warning">{c.destinationCountry} · cross-border</Chip>
                        ) : (
                          <Chip tone="success">{c.destinationCountry}</Chip>
                        )}
                      </td>
                      <td data-label="Seen on" className="border-b border-md-outline-variant px-4 py-3.5">
                        <span className="font-mono text-label-small text-md-on-surface-variant">{c.pageUrl}</span>
                      </td>
                      <td data-label="Requests" className="border-b border-md-outline-variant px-4 py-3.5 text-right text-body-small tabular-nums text-md-on-surface-variant">
                        {c.requestCount.toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Storage ──────────────────────────────────────────────────────── */}
      <Card>
        <CardBody>
          <CardHeader
            title="Storage written"
            sub="Cookie and web-storage keys the page wrote, and who wrote them where that is knowable."
          />
          {storage.length === 0 ? (
            <EmptyState icon="layers" title="No storage observed" body="Keys written during real page views appear here." />
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {storage.map((s) => (
                <li key={`${s.kind}-${s.name}`} className="flex items-center gap-3 rounded-2xl bg-md-surface-container-low px-4 py-3">
                  <Icon name="layers" size={18} className="shrink-0 text-md-on-surface-variant" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-body-small text-md-on-surface">{s.name}</span>
                    <span className="block text-label-small text-md-on-surface-variant">
                      {KIND_LABEL[s.kind] ?? s.kind}
                      {s.writer ? ` · written by ${s.writer}` : ' · writer not attributable'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 flex gap-3 border-t border-md-outline-variant pt-4 text-body-small leading-relaxed text-md-on-surface-variant">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <span>
              Rift records key names, never values, and hosts and paths, never query strings or
              request bodies — those are exactly where identifiers live, and a privacy product that
              collected them while cataloguing trackers would be doing the thing it exists to prevent.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
