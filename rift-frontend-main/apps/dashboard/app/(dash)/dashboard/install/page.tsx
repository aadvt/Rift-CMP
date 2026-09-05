import Link from 'next/link';
import { BlurField, Button, Card, CardBody, CardHeader, CodeBlock, Icon, Notice } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getSnippet } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Install' };

const HANDLED = [
  'Consent experience', 'Tracking controls', 'Consent records',
  'Analytics', 'Regional configuration', 'Configuration updates', 'Future scan findings',
];

export default async function InstallPage() {
  const snippet = await getSnippet(await requireSiteId());

  return (
    <>
      <ScreenHeader
        title="Install Rift"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'Installation' }]}
        actions={
          <Link href="/dashboard/install/verify">
            <Button variant="filled" iconAfter="arrowRight">I&rsquo;ve added the snippet</Button>
          </Link>
        }
      />

      <Screen>
        <div className="mx-auto max-w-[1120px]">
          <div className="relative mb-8 overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-10 motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <BlurField variant="hero" />
            <h2 className="relative text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">Your website is ready</h2>
            <p className="relative mt-4 max-w-[600px] text-body-large leading-relaxed text-md-on-surface-variant">
              Rift has prepared your privacy and analytics configuration. Install Rift once and it will handle the rest —
              there is no second snippet.
            </p>
          </div>

          <CodeBlock
            code={snippet.snippet}
            label="Add this snippet to your website"
            sub={<>Paste it inside <span className="font-mono text-[#C6D6E6]">&lt;head&gt;</span>, before any other analytics or tracking script.</>}
            meta={
              <div className="flex flex-wrap items-center gap-6">
                <Meta label="Site identifier" value={snippet.siteId} />
                <Meta label="Configuration" value={snippet.configurationVersion} />
                <Meta label="Size" value={snippet.sizeLabel} />
                <span className="ml-auto text-xs text-inverted-muted">
                  Configuration is fetched at runtime — the snippet never changes.
                </span>
              </div>
            }
          />

          <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Card className="rounded-2xl">
              <CardBody className="p-8">
                <div className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">That&rsquo;s it.</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-md-on-surface-variant">
                  You don&rsquo;t need separate snippets for analytics, consent, tracking control, consent logs or
                  reporting. Rift handles all of it from this one script.
                </p>
                <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {HANDLED.map((h) => (
                    <li key={h} className="flex items-center gap-3 py-2">
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-success-container text-md-on-success-container">
                        <Icon name="check" size={16} strokeWidth={2.2} />
                      </span>
                      <span className="text-body-medium text-md-on-surface">{h}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-md-outline-variant/40 pt-5">
                  <Link href="/dashboard/install/verify">
                    <Button variant="filled" iconAfter="arrowRight">Verify installation</Button>
                  </Link>
                  <span className="text-[12.5px] text-md-on-surface-variant/75">Verification takes about 10 seconds</span>
                </div>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader title="Where to paste it" />
                  <dl className="mt-3">
                    <Where name="Shopify" where="Online Store → Themes → Edit code → theme.liquid, inside &lt;head&gt;" />
                    <Where name="WordPress" where="Appearance → Theme File Editor → header.php, or any header-script plugin" />
                    <Where name="Webflow" where="Project settings → Custom code → Head code" />
                    <Where name="Next.js / React" where="The root layout’s &lt;head&gt;, above other third-party scripts" last />
                  </dl>
                </CardBody>
              </Card>

              <Notice tone="neutral" icon="info" title="If you use a Content Security Policy">
                Allow <span className="font-mono text-xs text-md-on-surface">cdn.rift.dev</span> in{' '}
                <span className="font-mono text-xs text-md-on-surface">script-src</span> and{' '}
                <span className="font-mono text-xs text-md-on-surface">connect-src</span>. Verification will tell you if this is
                the problem.
              </Notice>
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.04em] text-inverted-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[12.5px] text-inverted-ink">{value}</div>
    </div>
  );
}

function Where({ name, where, last }: { name: string; where: string; last?: boolean }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <Icon name="file" size={16} className="mt-0.5 shrink-0 text-md-on-surface-variant/75" />
      <div>
        <dt className="text-label-medium font-semibold text-md-on-surface">{name}</dt>
        <dd className="mt-0.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">{where}</dd>
      </div>
    </div>
  );
}
