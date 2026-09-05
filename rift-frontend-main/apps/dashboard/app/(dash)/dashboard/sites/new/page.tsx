import { BlurField, Button, Card, CardBody, Icon, RiftMark, WipeReveal } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { NewSiteForm } from '@/components/NewSiteForm';

export const metadata = { title: 'Add a website' };

const STEPS = [
  ['Rift scans your website', 'Pages, cookies, scripts, storage, network activity and third-party services.'],
  ['Rift determines what applies', 'Applicable privacy requirements for the regions your visitors come from.'],
  ['Rift writes the configuration', 'Consent categories, tracking controls, banner and regional behaviour.'],
  ['You paste one snippet', 'A single script tag. Rift handles consent, tracking, records and analytics from there.'],
];

/** The marketing site hands the URL over as `?url=` — accept it so the visitor
 *  doesn't retype what they already entered. */
export default async function NewSitePage({
  searchParams,
}: { searchParams: Promise<{ url?: string; from?: string }> }) {
  const { url, from } = await searchParams;
  return (
    <>
      {/* Picks up exactly where the marketing site's wipe stopped. */}
      {from === 'web' ? <WipeReveal label={url ? `Scanning ${hostOf(url)}` : 'Rift'} /> : null}

      <ScreenHeader title="Add a website" crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'New' }]} />

      <Screen>
        {/* Hero container: 48px radius and a layered atmospheric field. This is
            the one screen a first-time customer meets before anything else. */}
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-12">
          <BlurField variant="hero" />

          <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <h2 className="text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
              Protect your website with Rift
            </h2>
            <p className="mt-4 max-w-[520px] text-body-large leading-relaxed text-md-on-surface-variant">
              Enter your website URL and Rift will scan it, identify tracking technologies, determine the privacy
              configuration, and prepare your installation.
            </p>

            <NewSiteForm className="mt-7 max-w-[520px]" initialUrl={url ?? ''} />

            <Card tone="low" className="mt-8 max-w-[520px] rounded-xl">
              <CardBody className="p-5">
                <div className="flex gap-3.5">
                  <Icon name="check" size={22} className="mt-px shrink-0 text-md-success" />
                  <p className="text-label-medium leading-relaxed text-md-on-surface-variant">
                    <span className="font-medium text-md-on-surface">No code required to start.</span>{' '}
                    Rift will scan your website before asking you to configure anything — you won&rsquo;t be asked about
                    regulations, cookies or consent categories up front.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardBody>
                <div className="mb-4 flex items-center gap-2.5">
                  <RiftMark size={22} />
                  <span className="text-[13.5px] font-semibold text-md-on-surface">What happens after you press scan</span>
                </div>
                <ol className="flex flex-col gap-4">
                  {STEPS.map(([title, body], i) => (
                    <li key={title} className="flex gap-3.5">
                      <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-md-surface-variant text-label-small font-semibold text-md-on-surface-variant">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-md-on-surface">{title}</div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">{body}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>

            <Card tone="high" className="rounded-2xl shadow-none">
              <CardBody className="p-7">
                <div className="flex items-center gap-2.5">
                  <Icon name="info" size={20} className="text-md-on-surface-variant" />
                  <span className="text-body-medium font-medium text-md-on-surface">Scanning is read-only</span>
                </div>
                <p className="mt-2.5 text-label-medium leading-relaxed text-md-on-surface-variant">
                  Rift visits your site the way a visitor would. It doesn&rsquo;t change anything, doesn&rsquo;t need
                  credentials, and never touches your CMS or hosting.
                </p>
              </CardBody>
            </Card>
          </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function hostOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}
