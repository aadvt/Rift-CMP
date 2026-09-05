import Link from 'next/link';
import type { Route } from 'next';
import { Button, Card, CardBody, CardHeader, Chip, Confidence, Notice, RiftMark } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { AcceptConfiguration } from '@/components/AcceptConfiguration';
import { getConfiguration } from '@/lib/api/endpoints';

export const metadata = { title: 'Review configuration' };

export default async function ReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const config = await getConfiguration(siteId);

  return (
    <>
      <ScreenHeader
        title="Review configuration"
        crumb={[
          { label: 'Sites', href: '/dashboard/sites' },
          { label: 'Configuration', href: `/dashboard/sites/${siteId}/configuration` as Route },
          { label: 'Review' },
        ]}
        badge={<Chip tone="neutral"><span className="font-mono">{config.version}</span></Chip>}
        actions={<>
          <Link href="/dashboard/configure"><Button variant="tonal" icon="settings">Customise</Button></Link>
          <AcceptConfiguration siteId={siteId} />
        </>}
      />

      <Screen>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-[620px]">
              <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
                Every decision Rift made, in one place
              </h2>
              <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
                Nothing here was chosen by you yet. Each row shows what Rift found, how it classified it, and the
                consent behaviour that follows.
              </p>
            </div>
            <Notice tone="primary" icon="info" title="You can accept all of this as-is" className="max-w-[420px]">
              Overrides are available on every row, and each one keeps a restore path back to Rift&rsquo;s
              recommendation.
            </Notice>
          </div>

          <Card className="overflow-hidden rounded-2xl">
            <div className="p-7">
              <CardHeader title="Detected technologies" sub="Grouped by the consent category Rift assigned." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    {['Technology', 'Rift category', 'Confidence', 'Consent behaviour'].map((h) => (
                      <th key={h} className="h-14 bg-md-surface-container px-7 text-left text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.technologies.map((t) => (
                    <tr key={t.technologyId} className="border-b border-md-outline-variant/40">
                      <td className="px-7 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-body-medium font-medium text-md-on-secondary-container">
                            {t.name.charAt(0)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-md-on-surface">{t.name}</span>
                            <span className="block font-mono text-label-small text-md-on-surface-variant">{t.host}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-7 py-4 text-body-medium text-md-on-surface-variant">
                        {t.configuredCategory ?? <span className="opacity-70">Not classified</span>}
                      </td>
                      <td className="px-7 py-4"><Confidence level={t.confidence} /></td>
                      <td className="px-7 py-4 text-body-medium text-md-on-surface-variant">
                        {t.configuredCategory === 'Necessary'
                          ? 'Always available'
                          : t.configuredCategory
                            ? 'Controlled until consent'
                            : <span className="opacity-70">No behaviour assigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader title="Consent behaviour" sub="What happens to each category before and after a visitor decides." />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {config.consent.categories.map((c) => (
                    <div key={c.id} className="rounded-xl bg-md-surface-high p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-body-medium font-medium text-md-on-surface">{c.name}</span>
                        {c.alwaysActive ? <Chip tone="neutral">Always on</Chip> : <Chip tone="primary">Consent required</Chip>}
                      </div>
                      <div className="mt-3 text-label-medium font-medium text-md-on-surface">{c.behaviour}</div>
                      <p className="mt-1.5 text-label-medium leading-relaxed text-md-on-surface-variant">{c.description}</p>
                      <div className="mt-4 border-t border-md-outline-variant/50 pt-3 text-label-medium text-md-on-surface-variant tabular-nums">
                        {c.technologyCount} technolog{c.technologyCount === 1 ? 'y' : 'ies'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="overflow-hidden rounded-2xl">
              <div className="p-7">
                <CardHeader title="Regional behaviour" sub="Delivered by Rift’s policy layer — not decided in this dashboard." />
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {config.regions.map((r) => (
                    <tr key={r.code} className="border-b border-md-outline-variant/40 last:border-0">
                      <td className="py-4 pl-7 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-7 items-center rounded-full bg-md-surface-variant px-2.5 font-mono text-label-small text-md-on-surface-variant">
                            {r.shortCode}
                          </span>
                          <span className="font-medium text-md-on-surface">{r.name}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-body-medium text-md-on-surface-variant">{r.behaviour}</td>
                      <td className="py-4 pr-7 text-right text-body-medium text-md-on-surface-variant tabular-nums">
                        {r.visitorShare !== null ? `${r.visitorShare}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="bg-md-surface-high px-7 py-5 text-label-medium text-md-on-surface-variant">
                Visitor region is determined at request time by the Rift SDK, not stored in the browser.
              </p>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardBody className="flex flex-wrap items-center justify-between gap-6 p-7">
              <div className="flex items-center gap-4">
                <RiftMark size={40} />
                <div>
                  <div className="text-body-medium font-medium text-md-on-surface">
                    Use this configuration and Rift will handle the rest
                  </div>
                  <div className="mt-1 text-label-medium text-md-on-surface-variant">
                    Consent experience, tracking controls, records, analytics and future updates — from one snippet.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard/configure"><Button variant="tonal">Customise first</Button></Link>
                <AcceptConfiguration siteId={siteId} />
              </div>
            </CardBody>
          </Card>
        </div>
      </Screen>
    </>
  );
}
