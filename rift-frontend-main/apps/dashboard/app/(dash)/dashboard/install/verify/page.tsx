import Link from 'next/link';
import { Button, Card, CardBody, CardHeader, Chip, Icon, Notice, Stepper, type Step } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getVerification } from '@/lib/api/endpoints';
import { VERIFICATION_ISSUE } from '@/lib/api/fixtures';
import { USE_FIXTURES } from '@/lib/api/client';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Verify installation' };

/**
 * Both outcomes live on one route, because that is what the API returns.
 * `?state=issue` forces the not-activated path while running on fixtures, so
 * the failure design stays reviewable without breaking the install.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const siteId = await requireSiteId();
  const v = USE_FIXTURES && state === 'issue' ? VERIFICATION_ISSUE : await getVerification(siteId);
  const connected = v.status === 'connected';
  // Three states, not two. "Detected but not activated" is a real and specific
  // situation — the runtime is reporting and there is no configuration for it
  // to apply — and saying it to somebody whose snippet has never been seen
  // sends them looking for a problem in the wrong half of the system.
  const detected = v.status === 'not_activated';
  const headline = connected
    ? 'Your website is connected to Rift'
    : detected
      ? 'Rift was detected, but the configuration hasn’t activated yet'
      : 'Rift hasn’t heard from your website yet';
  const subhead = connected
    ? `All ${v.checks.length} checks passed. Nothing further is needed.`
    : detected
      ? 'Your snippet is on the page and the site identifier is correct — the install itself worked.'
      : 'Nothing has been received under this website’s key. If you have just added the snippet, load a page on your site and check again.';

  const steps: Step[] = v.checks.map((c) => ({
    id: c.id,
    label: c.label,
    state: c.state === 'passed' ? 'done' : c.state === 'running' ? 'active' : c.state === 'failed' ? 'failed' : c.state === 'skipped' ? 'skipped' : 'pending',
    ...(c.note ? { note: c.note } : {}),
    ...(c.durationMs ? { detail: `${c.durationMs} ms` } : {}),
  }));

  return (
    <>
      <ScreenHeader
        title="Verify installation"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'Installation', href: '/dashboard/install' }, { label: 'Verify' }]}
        badge={connected ? <Chip tone="success" dot>Connected</Chip> : <Chip tone="warning" dot>Needs attention</Chip>}
        actions={
          connected ? (
            <Link href={`/dashboard/sites/${siteId}`}><Button variant="filled" iconAfter="arrowRight">Go to site overview</Button></Link>
          ) : (
            <>
              <Link href="/dashboard/install"><Button variant="tonal" icon="code">View the snippet again</Button></Link>
              <Link href="/dashboard/install/verify"><Button variant="filled" icon="refresh">Check again</Button></Link>
            </>
          )
        }
      />

      <Screen>
        <div className="mx-auto grid max-w-[1060px] grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardBody className="p-6">
              <div className="flex items-center gap-3.5">
                <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg ${connected ? 'bg-md-success-container text-md-success' : 'bg-md-warning-container text-md-warning'}`}>
                  <Icon name={connected ? 'check' : 'alert'} size={22} strokeWidth={connected ? 2.2 : 1.6} />
                </span>
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.016em] text-md-on-surface">{headline}</h2>
                  <p className="mt-1 text-[13.5px] text-md-on-surface-variant">{subhead}</p>
                </div>
              </div>

              <Stepper steps={steps} className="mt-6" />

              {connected ? (
                <Notice tone="success" icon="check" title="Consent, tracking controls, records and analytics are live" className="mt-5">
                  You don&rsquo;t need to install anything else. Rift takes over from here.
                </Notice>
              ) : null}
            </CardBody>
          </Card>

          <div className="flex flex-col gap-5">
            {v.causes.length ? (
              <Card>
                <CardBody>
                  <CardHeader title="What is most likely happening" sub="In the order Rift would check them." />
                  <ol className="mt-4 flex flex-col gap-3">
                    {v.causes.map((c, i) => (
                      <li key={c.title} className={`rounded-sm border border-md-outline-variant p-4 ${i === 0 ? 'bg-md-background' : 'bg-md-surface-container'}`}>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-md-surface-variant text-label-small font-semibold text-md-on-surface-variant">
                            {i + 1}
                          </span>
                          <span className="text-[13.5px] font-semibold text-md-on-surface">{c.title}</span>
                          {i === 0 ? <Chip tone="warning">Most likely</Chip> : null}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">{c.detail}</p>
                        <div className="mt-2.5 flex items-start gap-2 border-t border-md-outline-variant/40 pt-2.5">
                          <Icon name="check" size={15} className="mt-0.5 shrink-0 text-md-success" />
                          <span className="text-[12.5px] leading-relaxed text-md-on-surface">
                            <span className="font-semibold">Try this:</span> {c.remedy}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody>
                  <CardHeader title="What happens from here" />
                  <ul className="mt-3.5 flex flex-col gap-4">
                    {[
                      ['consent', 'Visitors see the consent experience', 'Rift decides whether a banner is required from the visitor’s region and your configuration.'],
                      ['layers', 'Tracking follows the decision', 'Technologies are released or held per category, on every page, without extra code.'],
                      ['scans', 'Rift keeps scanning weekly', 'New technologies are classified and, where safe, configured automatically.'],
                      ['bell', 'You’re only interrupted when it matters', 'Uncertain changes come to your review queue. Everything else is handled.'],
                    ].map(([icon, title, body]) => (
                      <li key={title} className="flex gap-3">
                        <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-sm bg-md-surface-variant text-md-on-surface-variant">
                          <Icon name={icon as 'consent'} size={16} />
                        </span>
                        <div>
                          <div className="text-[13.5px] font-semibold leading-snug text-md-on-surface">{title}</div>
                          <div className="mt-0.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">{body}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {!connected ? (
              <Notice tone="neutral" icon="info" title="Your visitors are not affected right now">
                Rift has not taken control of tracking, so your site behaves exactly as it did before you added the
                snippet. Nothing has been blocked and no consent state has been written.
              </Notice>
            ) : null}

            {v.observations.length ? (
              <Card>
                <CardBody>
                  <CardHeader title="What Rift saw on your page" />
                  <dl className="mt-3.5 overflow-hidden rounded-sm border border-md-outline-variant">
                    {v.observations.map((o, i) => (
                      <div key={o.label} className={`flex items-center justify-between gap-3.5 px-3.5 py-2.5 ${i < v.observations.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                        <dt className="text-[12.5px] text-md-on-surface-variant">{o.label}</dt>
                        {/* The API speaks its own vocabulary; map it to a design tone
                            at the boundary rather than renaming the contract. */}
                        <dd className={`flex items-center gap-2 text-label-medium font-medium ${o.tone === 'ok' ? 'text-md-on-success-container' : 'text-md-on-warning-container'}`}>
                          <span className={`size-2 rounded-full ${o.tone === 'ok' ? 'bg-md-success' : 'bg-md-warning'}`} />
                          {o.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      </Screen>
    </>
  );
}
