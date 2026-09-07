import { Card, CardBody, CardHeader, Chip, Icon } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { DryRun } from '@/components/firewall/DryRun';
import { getConfiguration, getEnforcement, getSite } from '@/lib/api/endpoints';

export const metadata = { title: 'Consent firewall' };
export const dynamic = 'force-dynamic';

/**
 * The firewall, and what it would do.
 *
 * Enforcement elsewhere in the product reports what already happened. This is
 * the question that comes first: before turning enforcement on, what will it
 * actually do to my traffic — and can I check one destination without waiting
 * for a visitor to trigger it.
 *
 * The observed-outcomes banner is not decoration. Observe mode is what catches
 * people out: everything is evaluated, nothing is applied, and a dashboard that
 * showed blocks without saying so would report protection that does not exist.
 */
export default async function FirewallPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [site, config, enforcement] = await Promise.all([
    getSite(siteId),
    getConfiguration(siteId),
    getEnforcement(siteId),
  ]);

  const purposes = config.consent.categories.map((c) => c.id);

  // The runtime's enforcement mode is only reachable with the site's public
  // key, which this screen has no other reason to hold. What the log can say
  // for itself is how many recorded outcomes were observed rather than
  // applied — so that is what is claimed, rather than a mode inferred from it.
  const observedOnly = enforcement?.summary.observed_only ?? 0;

  return (
    <>
      <ScreenHeader
        title="Consent firewall"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: site.host }]}
        badge={observedOnly > 0 ? <Chip tone="warning" dot>Observed outcomes in log</Chip> : null}
      />
      <Screen>
        <div className="mb-5">
          <h2 className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
            What the firewall would do
          </h2>
          <p className="mt-2 max-w-[68ch] text-body-large leading-relaxed text-md-on-surface-variant">
            One evaluator decides every request, in the browser and on the server. This runs it
            against a destination you choose, using the approved configuration and a real visitor&rsquo;s
            recorded decisions — and records nothing.
          </p>
        </div>

        {observedOnly > 0 ? (
          <Card className="mb-5 bg-md-tertiary-container/40">
            <CardBody>
              <div className="flex gap-3">
                <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-md-tertiary" />
                <div>
                  <div className="text-title-large font-normal text-md-on-surface">
                    {observedOnly.toLocaleString('en-US')} recorded outcomes were observed, not applied
                  </div>
                  <p className="mt-1.5 max-w-[70ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                    A policy in observe mode evaluates every request and logs what it would have
                    done, without blocking anything. Where that is the case, a result below saying
                    &ldquo;blocked&rdquo; describes what would happen if you switched to enforcing —
                    not what is happening now.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <DryRun siteId={siteId} purposes={purposes} />

        <Card className="mt-5 bg-md-surface-container-low">
          <CardBody>
            <CardHeader
              title="Five classifications, two outcomes"
              sub="Both are reported, because collapsing them loses the reason and separating them invents behaviour that does not exist."
            />
            <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {([
                ['Allow', 'allow', 'No rule gates this destination, or the gating purpose was granted.'],
                ['Block', 'block', 'A rule gates it and the purpose was not granted. The request does not go.'],
                ['Require consent', 'allow', 'Gated on a purpose the visitor has granted, so it proceeds — but it is conditional, not unconditional.'],
                ['Redact', 'allow', 'The request goes, with matched fields removed, masked or hashed first.'],
                ['Review', 'allow', 'Nothing covers this destination. An absence of a control, not a control that fired — so it allows.'],
              ] as const).map(([label, effect, detail]) => (
                <div key={label} className="flex gap-3">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${effect === 'block' ? 'bg-md-error' : 'bg-md-primary'}`} />
                  <div>
                    <dt className="text-label-medium font-medium text-md-on-surface">
                      {label}
                      <span className="ml-2 font-normal text-md-on-surface-variant">request {effect}s</span>
                    </dt>
                    <dd className="mt-0.5 text-body-small leading-relaxed text-md-on-surface-variant">{detail}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </Screen>
    </>
  );
}
