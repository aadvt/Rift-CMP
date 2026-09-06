import { Screen, ScreenHeader } from '@/components/shell/ScreenHeader';
import { Simulator } from '@/components/simulate/Simulator';
import { ExportReportButton } from '@/components/ExportReportButton';
import { getSite } from '@/lib/api/endpoints';

export const metadata = { title: 'Simulate a change' };
export const dynamic = 'force-dynamic';

/**
 * The privacy impact simulator.
 *
 * A headline capability that shipped in Phase D with a working endpoint and no
 * way to reach it. This is that way.
 *
 * The screen is deliberately thin — everything interesting happens in the
 * client component, because a scenario is state somebody builds up before
 * anything is sent. The server's only job is to know which site this is.
 */
export default async function SimulatePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await getSite(siteId);

  return (
    <>
      <ScreenHeader
        title="Simulate a change"
        crumb={[
          { label: 'Sites', href: '/dashboard/sites' },
          { label: site.host },
          { label: 'Simulate' },
        ]}
        actions={<ExportReportButton label="Save scenario as PDF" />}
      />
      <Screen>
        <Simulator siteId={siteId} host={site.host} />
      </Screen>
    </>
  );
}
