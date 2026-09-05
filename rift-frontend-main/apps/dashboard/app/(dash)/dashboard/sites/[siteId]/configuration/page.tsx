import Link from 'next/link';
import { BlurField, Button, Card, CardBody, CardHeader, Chip, Icon, Notice } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getConfiguration } from '@/lib/api/endpoints';
import { AcceptConfiguration } from '@/components/AcceptConfiguration';

export const metadata = { title: 'Configuration' };

/**
 * The most important UX moment in the product: Rift has already built the
 * configuration. The primary action is to use it — never "configure
 * everything manually", which stays a quiet text link.
 */
export default async function ConfigurationPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const config = await getConfiguration(siteId);
  const e = config.enforcement;

  const summary: Array<[string, string]> = [
    ['Before consent', e.beforeConsent],
    ['After consent', e.afterConsent],
    ['Consent withdrawal', e.withdrawalEnabled ? 'Enabled' : 'Disabled'],
    ['Consent records', e.recordsEnabled ? 'Enabled' : 'Disabled'],
  ];

  return (
    <>
      <ScreenHeader
        title="Configuration"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'Privacy configuration' }]}
        actions={<>
          <Link href={`/dashboard/sites/${siteId}/configuration/review`}>
            <Button variant="tonal">Review configuration</Button>
          </Link>
          <AcceptConfiguration siteId={siteId} />
        </>}
      />

      <Screen>
        <div className="mx-auto max-w-[1120px]">
          <div className="relative overflow-hidden rounded-3xl bg-md-surface-container px-8 py-12 text-center md:px-12">
            <BlurField variant="hero" />
            <div className="relative">
              <Chip tone="success" glyph="check" className="h-8 px-4">Generated automatically from your scan</Chip>
              <h2 className="mt-5 text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
                Your Rift configuration is ready
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-body-large leading-relaxed text-md-on-surface-variant">
                Rift analysed your website and prepared a consent and tracking configuration. You don&rsquo;t need to
                build it — review it if you want, then use it.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <AcceptConfiguration siteId={siteId} size="lg" />
                <Link href={`/dashboard/sites/${siteId}/configuration/review`}>
                  <Button variant="tonal" size="lg">Review configuration</Button>
                </Link>
              </div>
              <p className="mt-5 text-label-medium text-md-on-surface-variant">
                You can change anything later without reinstalling —{' '}
                <Link href="/dashboard/configure" className="font-medium text-md-primary underline-offset-4 hover:underline">
                  configure manually instead
                </Link>.
              </p>
            </div>
          </div>

          <Card className="mt-5 rounded-2xl">
            <CardBody className="grid grid-cols-2 gap-8 p-7 lg:grid-cols-4 lg:gap-0">
              {([
                [String(config.technologies.length), 'technologies configured', false],
                [String(config.consent.categories.length), 'consent categories', false],
                [String(config.regions.length), 'regions covered', false],
                [String(config.unresolved.length), 'unresolved items', true],
              ] as const).map(([n, l, warn], i) => (
                <div key={l} className={i ? 'lg:border-l lg:border-md-outline-variant/60 lg:pl-8' : 'lg:pr-8'}>
                  <div className={`text-headline-medium font-normal leading-none tabular-nums ${warn && Number(n) > 0 ? 'text-md-warning' : 'text-md-on-surface'}`}>{n}</div>
                  <div className="mt-2 text-label-medium text-md-on-surface-variant">{l}</div>
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader
                  title="Consent categories"
                  sub="Rift grouped every technology it found into the categories your configuration uses."
                />
                <dl className="mt-5">
                  {config.consent.categories.map((c, i, arr) => (
                    <div key={c.id} className={`flex items-center gap-4 py-4 ${i < arr.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <dt className="flex flex-wrap items-center gap-2.5">
                          <span className="text-body-medium font-medium text-md-on-surface">{c.name}</span>
                          {c.alwaysActive ? <Chip tone="neutral">Always on</Chip> : null}
                        </dt>
                        <dd className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">{c.behaviour}</dd>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-title-large font-normal text-md-on-surface tabular-nums">{c.technologyCount}</span>
                        <span className="ml-2 text-label-medium text-md-on-surface-variant">
                          technolog{c.technologyCount === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader title="Tracking behaviour" />
                  <dl className="mt-5">
                    {summary.map(([k, v], i) => (
                      <div key={k} className={`flex items-baseline justify-between gap-4 py-3 ${i < summary.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                        <dt className="text-label-medium text-md-on-surface-variant">{k}</dt>
                        <dd className="text-right text-body-medium font-medium text-md-on-surface">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 border-t border-md-outline-variant/40 pt-5">
                    <div className="text-label-medium text-md-on-surface-variant">Regional behaviour</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {config.regions.map((r) => <Chip key={r.code} tone="primary">{r.name}</Chip>)}
                    </div>
                  </div>
                </CardBody>
              </Card>

              {config.unresolved.length ? (
                <Notice
                  tone="neutral"
                  icon="question"
                  title={`${config.unresolved.length} item is still unresolved — it isn’t blocking you`}
                  actions={<Button size="sm" variant="tonal">Review the finding</Button>}
                >
                  Rift could not classify{' '}
                  <span className="font-mono text-label-medium">{config.unresolved[0]?.host}</span>. It has not been
                  placed in a consent category and no claim has been made about it. You can use this configuration now
                  and resolve it whenever you like.
                </Notice>
              ) : null}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}
