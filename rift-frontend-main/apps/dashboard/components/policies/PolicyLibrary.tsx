import { Card, CardBody, CardHeader, Chip, EmptyState, Icon } from '@rift/ui';
import type { NoticeRecord, PolicyRecord } from '@/lib/api/types';

/**
 * The documents a consent record is evidence *against*.
 *
 * ## Why versions lead
 *
 * A policy is a name; its text lives in versions that never change once
 * published. Every consent record points at one, and that pointer is what makes
 * the record mean anything later — "they agreed to this" is only a claim if the
 * thing they agreed to can still be produced, byte for byte.
 *
 * So the version list is the substance of this screen and the policy is the
 * heading above it. The newest version is marked live because that is the one
 * new decisions are being recorded against right now; the older ones are not
 * expired, they are what earlier decisions still refer to.
 *
 * ## Notices are shown beside them, not under them
 *
 * A notice is what a version actually *said*, in one locale. Two locales of the
 * same version are two notices and one document, which is why they are grouped
 * by version rather than listed flat: a reader checking what a Hindi-speaking
 * visitor was shown needs to find it under the version they consented to.
 */
export function PolicyLibrary({
  policies, notices,
}: { policies: PolicyRecord[]; notices: NoticeRecord[] }) {
  if (policies.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="file"
          title="No policies published yet"
          body="A policy is the document your consent records point at. Rift creates the first one with your configuration — publish a configuration and it appears here with its version history."
        />
      </Card>
    );
  }

  const noticesFor = (versionId: string) => notices.filter((n) => n.policyVersionId === versionId);

  return (
    <div className="flex flex-col gap-5">
      {policies.map((policy) => (
        <Card key={policy.policyId}>
          <CardBody>
            <CardHeader
              title={policy.name}
              sub={`Created ${new Date(policy.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              action={<Chip tone="neutral">{policy.code}</Chip>}
            />

            <ol className="mt-6 flex flex-col">
              {policy.versions.map((v, i) => {
                const live = i === 0;
                const forThis = noticesFor(v.versionId);
                const last = i === policy.versions.length - 1;
                return (
                  <li key={v.versionId} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last && (
                      <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-0 w-px bg-md-outline-variant" />
                    )}
                    <span
                      className={`relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${
                        live
                          ? 'bg-md-primary-container text-md-on-primary-container'
                          : 'bg-md-surface-container text-md-on-surface-variant'
                      }`}
                    >
                      <Icon name="file" size={19} />
                    </span>

                    <div className="min-w-0 flex-1 pt-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-body-medium text-md-on-surface">{v.version}</span>
                        {live ? <Chip tone="success" dot>Live</Chip> : <Chip tone="neutral">Superseded</Chip>}
                        <span className="ml-auto shrink-0 text-label-small tabular-nums text-md-on-surface-variant">
                          {new Date(v.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {!live ? (
                        <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
                          Not expired — this is what decisions recorded before{' '}
                          {new Date(policy.versions[i - 1]!.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
                          still refer to.
                        </p>
                      ) : null}

                      <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-label-small text-md-on-surface-variant">
                        {v.documentUrl ? (
                          <div className="flex items-center gap-1.5">
                            <dt>Document</dt>
                            <dd>
                              <a
                                href={v.documentUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 text-md-primary underline-offset-2 hover:underline"
                              >
                                {v.documentUrl.replace(/^https?:\/\//, '')}
                                <Icon name="external" size={13} />
                              </a>
                            </dd>
                          </div>
                        ) : null}
                        {v.contentHash ? (
                          <div className="flex items-center gap-1.5">
                            <dt>Hash</dt>
                            <dd className="font-mono text-md-on-surface">{v.contentHash}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {forThis.length > 0 ? (
                        <div className="mt-3.5 flex flex-col gap-2 rounded-2xl bg-md-surface-container-low p-4">
                          <span className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                            What this version disclosed
                          </span>
                          {forThis.map((n) => (
                            <div key={n.noticeId} className="flex flex-wrap items-center gap-2">
                              <Chip tone="primary">{n.locale}</Chip>
                              <span className="font-mono text-label-small text-md-on-surface-variant">{n.noticeId}</span>
                              <span className="flex flex-wrap gap-1.5">
                                {n.purposeCodes.map((p) => (
                                  <span
                                    key={p}
                                    className="rounded-full bg-md-surface px-2.5 py-0.5 font-mono text-label-small text-md-on-surface-variant"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-body-small text-md-on-surface-variant">
                          No notice recorded against this version.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      ))}

      <Card className="bg-md-surface-container-low">
        <CardBody>
          <p className="flex gap-3 text-body-small leading-relaxed text-md-on-surface-variant">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <span>
              Versions are immutable by design. Rift publishes a new one rather than editing an old
              one, because a consent record that pointed at a document which later changed would be
              evidence of nothing.
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
