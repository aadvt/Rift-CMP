import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { DataFlow } from '@/components/dataflow/DataFlow';
import { getDataFlowMap, getSite } from '@/lib/api/endpoints';

export const metadata = { title: 'Data flow' };
export const dynamic = 'force-dynamic';

/**
 * Where this site's data goes, from both ends.
 *
 * Distinct from the consent graph next door: that answers "which vendor depends
 * on which purpose", a question about configuration. This answers "what left,
 * and to which country", a question about what actually happened.
 */
export default async function DataFlowPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [site, map] = await Promise.all([getSite(siteId), getDataFlowMap(siteId)]);

  return (
    <>
      <ScreenHeader
        title="Data flow"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: site.host }]}
      />
      <Screen>
        <div className="mb-5">
          <h2 className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
            Where {site.host} sends data
          </h2>
          <p className="mt-2 max-w-[68ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Observed destinations from real page views, and the transfers your systems released
            under a consent authorisation. A destination outside India is called out because DPDP
            treats it as a separate obligation.
          </p>
        </div>
        <DataFlow map={map} />
      </Screen>
    </>
  );
}
