import { Card, CardBody, CardHeader, Chip, EmptyState, Icon, type ChipTone } from '@rift/ui';
import type { AuditEntry, AuditKind } from '@/lib/api/types';

/**
 * Consent, authorisation and transfer on one timeline.
 *
 * ## Why this screen exists
 *
 * The platform stores the three domains separately and deliberately does not
 * join them in the database. `/v1/audit` joins them for a reader — and that
 * join is the whole value, because the question an auditor actually asks is not
 * "what consents do you hold" but "show me this decision, the permission it
 * justified, and the data that moved because of it".
 *
 * So the cross-reference ids are rendered as a visible chain rather than
 * hidden. A row that names a consent record, an authorisation and a transfer is
 * one story in three parts, and grouping by that chain is what makes it
 * followable.
 *
 * ## Refusals are kept, not filtered
 *
 * An authorisation that was refused is the most interesting row on the screen:
 * it is the system declining to move data, which is the behaviour the product
 * exists to produce. It gets a neutral-to-positive treatment, never an error
 * tone — a refusal here is the control working.
 */

const KIND: Record<AuditKind, { label: string; icon: 'consent' | 'layers' | 'external'; tone: string }> = {
  consent: { label: 'Consent', icon: 'consent', tone: 'bg-md-primary-container text-md-on-primary-container' },
  authorisation: { label: 'Authorisation', icon: 'layers', tone: 'bg-md-secondary-container text-md-on-secondary-container' },
  transfer: { label: 'Transfer', icon: 'external', tone: 'bg-md-tertiary-container text-md-on-tertiary-container' },
};

function statusTone(status: string): ChipTone {
  const s = status.toUpperCase();
  if (s === 'GRANTED' || s === 'DELIVERED' || s === 'AUTHORISED') return 'success';
  if (s === 'DENIED' || s === 'WITHDRAWN' || s === 'REFUSED') return 'neutral';
  if (s === 'FAILED' || s === 'EXPIRED') return 'warning';
  return 'neutral';
}

export function Timeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="layers"
          title="Nothing to audit yet"
          body="Once visitors start deciding and your systems start moving data under those decisions, every consent, authorisation and transfer appears here on one timeline."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <CardHeader
          title="Every decision, and what followed from it"
          sub="Consent, authorisations and transfers interleaved. The platform keeps these three apart; this joins them for a reader."
        />

        <ol className="mt-6 flex flex-col">
          {entries.map((e, i) => {
            const k = KIND[e.kind];
            const last = i === entries.length - 1;
            return (
              <li key={`${e.kind}-${e.at}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && (
                  <span aria-hidden="true" className="absolute left-[19px] top-10 bottom-0 w-px bg-md-outline-variant" />
                )}

                <span className={`relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                  <Icon name={k.icon} size={19} />
                </span>

                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-label-medium font-medium text-md-on-surface">{k.label}</span>
                    <Chip tone={statusTone(e.status)}>{e.status}</Chip>
                    <span className="ml-auto shrink-0 text-label-small tabular-nums text-md-on-surface-variant">
                      {new Date(e.at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* The platform's own sentence, unedited. */}
                  <p className="mt-1.5 text-body-medium leading-relaxed text-md-on-surface">{e.summary}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-label-small text-md-on-surface-variant">
                    <span>
                      Visitor <span className="font-mono text-md-on-surface">{e.principal}</span>
                    </span>
                    <span>
                      Purpose <span className="font-mono text-md-on-surface">{e.purposeCode}</span>
                    </span>
                  </div>

                  {/* The chain. Present so one decision can be followed through. */}
                  {(e.consentRecordId || e.authorisationId || e.transferId) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {e.consentRecordId ? <Ref label="consent" value={e.consentRecordId} /> : null}
                      {e.authorisationId ? <Ref label="authorisation" value={e.authorisationId} /> : null}
                      {e.transferId ? <Ref label="transfer" value={e.transferId} /> : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 flex gap-3 border-t border-md-outline-variant pt-5 text-body-small leading-relaxed text-md-on-surface-variant">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          <span>
            A refused authorisation is not an error. It is the system declining to move data because
            the consent behind it did not permit the action — which is the behaviour this product
            exists to produce, and worth as much in an audit as a successful one.
          </span>
        </p>
      </CardBody>
    </Card>
  );
}

function Ref({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-md-surface-container px-2.5 py-1">
      <span className="text-label-small uppercase tracking-[0.06em] text-md-on-surface-variant/70">{label}</span>
      <span className="font-mono text-label-small text-md-on-surface">{value}</span>
    </span>
  );
}
