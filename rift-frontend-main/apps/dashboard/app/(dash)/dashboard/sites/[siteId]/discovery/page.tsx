import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { Inventory } from '@/components/discovery/Inventory';
import { getDiscoveryInventory, getSite } from '@/lib/api/endpoints';

export const metadata = { title: 'Runtime discovery' };
export const dynamic = 'force-dynamic';

/**
 * What ran on the site's pages, as observed from inside real visits.
 *
 * Sits beside Intelligence rather than inside it on purpose. Intelligence
 * reasons over the *scan*: what a crawl found and what the policy engine made
 * of it. This is the runtime record — what actually left a real visitor's
 * browser, and whether any of it left while consent said it should not.
 *
 * The two disagree more often than either is wrong: a crawl cannot see a tag
 * that only loads after login, and the runtime cannot see a page nobody visited.
 */
export default async function DiscoveryPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [site, inventory] = await Promise.all([getSite(siteId), getDiscoveryInventory(siteId)]);

  return (
    <>
      <ScreenHeader
        title="Runtime discovery"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: site.host }]}
      />
      <Screen>
        <div className="mb-5">
          <h2 className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
            What really ran on {site.host}
          </h2>
          <p className="mt-2 max-w-[68ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Collected by the Rift SDK during real page views, not by a crawler. It catches
            lazy-loaded tags and logged-in states a crawl never reaches — and it is the only place
            that can tell you a request actually left the browser.
          </p>
        </div>
        <Inventory inventory={inventory} />
      </Screen>
    </>
  );
}
