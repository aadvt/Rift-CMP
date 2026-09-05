import { Card, CardBody, CardHeader, Toggle } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getConfiguration } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const config = await getConfiguration(await requireSiteId());

  return (
    <>
      <ScreenHeader title="Settings" />
      <Screen>
        <div className="mx-auto grid max-w-[840px] grid-cols-1 gap-5">
          <Card>
            <CardBody>
              <CardHeader title="Consent renewal" sub="How long a decision stands before Rift asks again." />
              <dl className="mt-4">
                <Row label="Renew consent after" value={config.enforcement.renewAfterMonths ? `${config.enforcement.renewAfterMonths} months` : 'Never'} />
                <Row label="Before consent" value={config.enforcement.beforeConsent} />
                <Row label="After consent" value={config.enforcement.afterConsent} last />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardHeader title="Consent records" sub="What Rift keeps with every decision." />
              <div className="mt-4 flex flex-col">
                <ToggleRow label="Record every decision" note="Required for the consent dashboard and exports." on={config.enforcement.recordsEnabled} locked />
                <ToggleRow label="Allow consent withdrawal" note="A persistent control lets visitors change their mind at any time." on={config.enforcement.withdrawalEnabled} />
                <ToggleRow label="Store the raw IP address" note="Off by default. Rift does not need it." on={false} last />
              </div>
            </CardBody>
          </Card>
        </div>
      </Screen>
    </>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <dt className="text-label-medium text-md-on-surface-variant/75">{label}</dt>
      <dd className="text-[13.5px] font-semibold text-md-on-surface">{value}</dd>
    </div>
  );
}

function ToggleRow({ label, note, on, locked, last }: { label: string; note: string; on: boolean; locked?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-md-on-surface">{label}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">{note}</div>
      </div>
      <Toggle defaultChecked={on} disabled={locked} aria-label={label} />
    </div>
  );
}
