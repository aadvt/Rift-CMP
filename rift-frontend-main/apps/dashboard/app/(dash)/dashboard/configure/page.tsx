import Link from 'next/link';
import { Button, Card, CardBody, CardHeader, Field, Input, RiftMark, Toggle, cn } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { OverrideGrid } from '@/components/OverrideGrid';
import { getConfiguration } from '@/lib/api/endpoints';
import { getSite } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Advanced configuration' };

export default async function ConfigurePage() {
  const siteId = await requireSiteId();
  const [config, site] = await Promise.all([getConfiguration(siteId), getSite(siteId)]);
  const e = config.enforcement;

  // Counts come from the configuration rather than from a constant, so a
  // section that says "11" is a section with eleven things in it.
  const sections: ReadonlyArray<readonly [string, string]> = [
    ['Consent categories', String(config.consent.categories.length)],
    ['Technologies', String(config.technologies.length)],
    ['Regional behaviour', String(config.regions.length)],
    ['Banner appearance', ''],
    ['Consent renewal', ''],
    ['Consent records', ''],
    ['Advanced rules', ''],
  ];

  return (
    <>
      <ScreenHeader
        title="Advanced configuration"
        crumb={[{ label: site.host }, { label: 'Configure' }]}
        actions={<Button variant="filled" icon="check">Save configuration</Button>}
      />

      <Screen>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24">
            <Card tone="low" className="rounded-2xl">
              <CardBody className="p-3">
                <div className="px-4 py-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                  Sections
                </div>
                <nav className="flex flex-col gap-1">
                  {sections.map(([label, n], i) => (
                    <span
                      key={label}
                      className={cn(
                        'flex h-12 cursor-pointer items-center gap-3 rounded-full px-5 text-label-medium font-medium transition-colors duration-[--md-duration-fast] ease-md',
                        i === 1 ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface-variant hover:bg-md-primary/10',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {n ? <span className="text-label-small tabular-nums opacity-70">{n}</span> : null}
                    </span>
                  ))}
                </nav>
              </CardBody>
            </Card>

            <Card tone="high" className="mt-4 rounded-2xl shadow-none">
              <CardBody className="p-6">
                <div className="mb-3 flex items-center gap-2.5">
                  <RiftMark size={22} />
                  <span className="text-label-medium font-medium text-md-on-surface">Rift keeps this current</span>
                </div>
                <p className="text-label-medium leading-relaxed text-md-on-surface-variant">
                  Anything you don&rsquo;t override is maintained automatically as new technologies appear. Overrides
                  are preserved through future scans.
                </p>
                <Link
                  href={`/dashboard/sites/${siteId}/configuration`}
                  className="mt-4 inline-block text-label-medium font-medium text-md-primary underline-offset-4 hover:underline"
                >
                  Back to Rift&rsquo;s configuration
                </Link>
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <OverrideGrid
              siteId={siteId}
              technologies={config.technologies}
              categories={config.consent.categories}
            />

            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader
                  title="Banner appearance"
                  sub="Wording and placement for the visitor-facing consent experience. Rift generates the rest."
                  action={
                    <Link href="/preview/banner">
                      <Button variant="tonal" size="sm" iconAfter="arrowUpRight">Open preview</Button>
                    </Link>
                  }
                />
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex flex-col gap-5">
                    <Field label="Banner title" htmlFor="banner-title">
                      <Input id="banner-title" defaultValue={config.consent.banner.title} />
                    </Field>
                    <Field
                      label="Banner body"
                      htmlFor="banner-body"
                      hint="Plain language. Rift will not add legal boilerplate on your behalf."
                    >
                      <Input id="banner-body" defaultValue={config.consent.banner.body} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Accept label" htmlFor="banner-accept">
                        <Input id="banner-accept" defaultValue={config.consent.banner.acceptAllLabel} />
                      </Field>
                      <Field label="Reject label" htmlFor="banner-reject">
                        <Input id="banner-reject" defaultValue={config.consent.banner.rejectLabel} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl bg-md-surface-high p-5">
                    <div className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                      Live shape
                    </div>
                    <div className="mt-4 rounded-2xl bg-md-surface p-5">
                      <div className="text-body-medium font-medium text-md-on-surface">{config.consent.banner.title}</div>
                      <p className="mt-2 line-clamp-3 text-label-medium leading-relaxed text-md-on-surface-variant">
                        {config.consent.banner.body}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex h-9 items-center rounded-full bg-md-primary px-4 text-label-small font-medium text-md-on-primary">
                          {config.consent.banner.acceptAllLabel}
                        </span>
                        <span className="inline-flex h-9 items-center rounded-full bg-md-secondary-container px-4 text-label-small font-medium text-md-on-secondary-container">
                          {config.consent.banner.rejectLabel}
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 text-label-medium leading-relaxed text-md-on-surface-variant">
                      Reject always carries the same visual weight as accept. Rift does not offer a layout where it
                      doesn&rsquo;t.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader title="Consent renewal" sub="How long a decision stands before Rift asks again." />
                  <dl className="mt-5">
                    <Row label="Renew consent after" value={e.renewAfterMonths ? `${e.renewAfterMonths} months` : 'Never'} />
                    <div className="flex items-start justify-between gap-4 pt-4">
                      <div>
                        <div className="text-body-medium font-medium text-md-on-surface">
                          Re-ask when the configuration changes materially
                        </div>
                        <div className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">
                          Only when a new category or a new purpose is introduced.
                        </div>
                      </div>
                      <Toggle defaultChecked aria-label="Re-ask on material configuration change" />
                    </div>
                  </dl>
                </CardBody>
              </Card>

              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader title="Consent records" sub="What Rift keeps with every decision." />
                  <div className="mt-5 flex flex-col">
                    {([
                      ['Record every decision', true, true, 'Required for the consent dashboard and exports.'],
                      ['Store the configuration version', true, false, 'Lets you show exactly what a visitor agreed to.'],
                      ['Store a coarse region', true, false, 'Region only — never a precise location.'],
                      ['Store the raw IP address', false, false, 'Off by default. Rift does not need it.'],
                    ] as const).map(([label, on, locked, note], i, arr) => (
                      <div key={label} className={`flex items-start justify-between gap-4 py-4 ${i < arr.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <div className="text-body-medium font-medium text-md-on-surface">{label}</div>
                          <div className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">{note}</div>
                        </div>
                        <Toggle defaultChecked={on} disabled={locked} aria-label={label} />
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-md-outline-variant/40 py-3">
      <dt className="text-label-medium text-md-on-surface-variant">{label}</dt>
      <dd className="text-body-medium font-medium text-md-on-surface">{value}</dd>
    </div>
  );
}
