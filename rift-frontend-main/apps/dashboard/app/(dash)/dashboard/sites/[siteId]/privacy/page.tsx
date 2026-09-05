import Link from 'next/link';
import { BlurField, Button, Card, CardBody, CardHeader, Chip, Icon, Notice, RiftMark } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getConfiguration, getSite } from '@/lib/api/endpoints';

export const metadata = { title: 'Privacy assessment' };

/**
 * Rift keeps five things separate so the UI never turns an uncertain
 * inference into a definitive legal statement: scanner evidence, regulation
 * applicability, policy interpretation, company configuration, and the
 * questions Rift will not answer on your behalf.
 */
const CHAIN = [
  { k: 'Scan evidence', v: 'What Rift observed on your website', tone: 'primary' },
  { k: 'Regulation applicability', v: 'Which requirements reach your visitors', tone: 'primary' },
  { k: 'Policy interpretation', v: 'How Rift turns a requirement into behaviour', tone: 'neutral' },
  { k: 'Company configuration', v: 'What you chose or overrode', tone: 'neutral' },
  { k: 'Unresolved questions', v: 'What Rift will not decide for you', tone: 'warning' },
] as const;

export default async function PrivacyPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [site, config] = await Promise.all([getSite(siteId), getConfiguration(siteId)]);

  return (
    <>
      <ScreenHeader
        title="Privacy assessment"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: site.host }, { label: 'Privacy' }]}
        actions={<>
          <Button variant="tonal">Change visitor regions</Button>
          <Link href={`/dashboard/sites/${siteId}/configuration`}>
            <Button variant="filled" iconAfter="arrowRight">Continue to configuration</Button>
          </Link>
        </>}
      />

      <Screen>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <div className="relative overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-10">
              <BlurField variant="hero" />
              <h2 className="relative text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
                Rift privacy assessment
              </h2>
              <p className="relative mt-4 max-w-[620px] text-body-large leading-relaxed text-md-on-surface-variant">
                Based on what Rift found on your website and where your visitors are, these are the privacy
                requirements Rift applied when it generated your configuration.
              </p>
            </div>

            <Notice tone="neutral" icon="info" title="This is Rift’s assessment, not a legal determination">
              Rift tells you what it observed, which requirements it believes apply, and how confident it is. Where it
              cannot be confident it says so and leaves the decision open rather than guessing.
            </Notice>

            <div className="flex flex-col gap-4">
              {config.regions.map((r, i) => (
                <Card key={r.code} className="overflow-hidden rounded-2xl">
                  <div className="flex flex-wrap items-start gap-4 p-7">
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-md-secondary-container font-mono text-label-medium font-medium text-md-on-secondary-container">
                      {r.shortCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-title-large font-medium text-md-on-surface">{r.name}</span>
                        {r.confidence === 'high'
                          ? <Chip tone="success" glyph="check">High confidence</Chip>
                          : <Chip tone="warning">Medium confidence</Chip>}
                        {r.visitorShare !== null ? (
                          <span className="text-label-medium text-md-on-surface-variant">{r.visitorShare}% of your visitors</span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-body-medium text-md-on-surface-variant">{r.requirement}</div>
                    </div>
                    <Button variant="text" size="sm" iconAfter={i === 0 ? 'chevronDown' : 'chevronRight'}>
                      {i === 0 ? 'Hide reasoning' : 'View reasoning'}
                    </Button>
                  </div>

                  {i === 0 && r.reasoning ? (
                    <div className="bg-md-surface-high p-7 motion-safe:animate-[md-fade_300ms_var(--md-ease)]">
                      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
                        <div>
                          <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                            Requirement
                          </div>
                          <div className="text-body-medium font-medium text-md-on-surface">{r.behaviour}</div>
                          <p className="mt-2 text-label-medium leading-relaxed text-md-on-surface-variant">
                            Analytics, marketing and preferences technologies are held until the visitor has made a
                            choice. Necessary technologies are not.
                          </p>
                        </div>
                        <div>
                          <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                            Why Rift selected this
                          </div>
                          <ul className="flex flex-col gap-2.5">
                            {r.reasoning.factors.map((t) => (
                              <li key={t} className="flex items-start gap-2.5">
                                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-md-primary" />
                                <span className="text-label-medium leading-relaxed text-md-on-surface-variant">{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center gap-7 border-t border-md-outline-variant/50 pt-5">
                        <Meta label="Source" value={r.reasoning.source} />
                        <Meta label="Knowledge base" value={r.reasoning.knowledgeBaseVersion} mono />
                        <Meta label="Applied" value={new Date(r.reasoning.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                        <Button variant="outlined" size="sm" iconAfter="arrowUpRight" className="ml-auto">View evidence</Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>

            {config.unresolved.length ? (
              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader
                    title="Open questions Rift will not answer for you"
                    sub="These stay open until you decide. Nothing is blocked in the meantime."
                  />
                  <Notice tone="neutral" icon="question" title="Legal basis for one unclassified technology" className="mt-5"
                    actions={<>
                      <Button size="sm" variant="tonal">Classify technology</Button>
                      <Button size="sm" variant="text">Leave unresolved</Button>
                    </>}
                  >
                    Rift detected <span className="font-mono text-label-medium">{config.unresolved[0]?.host}</span> but
                    could not determine its purpose. Until it is classified Rift has not assigned it a consent category
                    and has made no claim about whether it needs consent.
                  </Notice>
                </CardBody>
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader
                  title="How Rift reached this"
                  sub="Each step is kept separate so you can see where evidence ends and interpretation begins."
                />
                <ol className="mt-6 flex flex-col">
                  {CHAIN.map((c, i) => (
                    <li key={c.k} className={`relative flex gap-4 ${i === CHAIN.length - 1 ? '' : 'pb-6'}`}>
                      {i < CHAIN.length - 1 ? (
                        <span aria-hidden="true" className="absolute left-[13px] top-8 bottom-0 w-0.5 rounded-full bg-md-outline-variant/60" />
                      ) : null}
                      <span
                        className={`relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                          c.tone === 'primary' ? 'bg-md-secondary-container' : c.tone === 'warning' ? 'bg-md-warning-container' : 'bg-md-surface-variant'
                        }`}
                      >
                        <span className={`size-2.5 rounded-full ${c.tone === 'primary' ? 'bg-md-primary' : c.tone === 'warning' ? 'bg-md-warning' : 'bg-md-on-surface-variant'}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-body-medium font-medium text-md-on-surface">{c.k}</div>
                        <div className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">{c.v}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>

            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader title="Applied behaviour by region" sub="What your visitors will actually experience." />
                <dl className="mt-4">
                  {config.regions.map((r, i) => (
                    <div key={r.code} className={`flex items-start gap-3.5 py-3 ${i < config.regions.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-md-surface-variant px-2.5 font-mono text-label-small text-md-on-surface-variant">
                        {r.shortCode}
                      </span>
                      <div className="min-w-0 flex-1">
                        <dt className="text-body-medium font-medium text-md-on-surface">{r.name}</dt>
                        <dd className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">{r.behaviour}</dd>
                      </div>
                      <Icon name="check" size={18} className="mt-1 shrink-0 text-md-success" />
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>

            <Card tone="high" className="rounded-2xl shadow-none">
              <CardBody className="p-7">
                <div className="mb-3 flex items-center gap-3">
                  <RiftMark size={26} />
                  <span className="text-body-medium font-medium text-md-on-surface">Where this came from</span>
                </div>
                <p className="text-label-medium leading-relaxed text-md-on-surface-variant">
                  Applicability and behaviour are decided by Rift&rsquo;s policy layer and delivered to this dashboard
                  as an explicit configuration. Nothing on this screen is inferred in your browser.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-mono text-label-medium text-md-on-surface">{config.version}</span>
                  <Chip tone="success" dot>Current</Chip>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-label-small text-md-on-surface-variant">{label}</div>
      <div className={`mt-1 text-label-medium font-medium text-md-on-surface ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
