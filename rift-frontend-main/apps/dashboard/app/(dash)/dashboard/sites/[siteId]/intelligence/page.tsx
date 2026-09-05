import { Tabs, TabsContent, TabsList, TabsTrigger } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import {
  getAutopilot,
  getIntelligence,
  getPageIntelligence,
  getQuality,
} from '@/lib/api/endpoints';
import { QualityScore } from '@/components/intelligence/QualityScore';
import { ShadowTrackers, DriftFindings } from '@/components/intelligence/Findings';
import { PageIntelligence } from '@/components/intelligence/PageIntelligence';
import { Autopilot } from '@/components/intelligence/Autopilot';

export const metadata = { title: 'Intelligence' };
export const dynamic = 'force-dynamic';

/**
 * Everything Rift has worked out about one site.
 *
 * Five readings of the same evidence, kept on one screen because they answer
 * one question between them — is this site set up properly, and if not, what
 * exactly is wrong. Splitting them across the navigation would make an operator
 * assemble that answer themselves from four places.
 *
 * Each request degrades on its own: a site with no scan still shows its score,
 * and a score that fails to load does not blank the findings beside it.
 */
export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  const [quality, intelligence, pages, autopilot] = await Promise.all([
    getQuality(siteId),
    getIntelligence(siteId),
    getPageIntelligence(siteId),
    getAutopilot(siteId),
  ]);

  const shadow = intelligence?.shadow_trackers ?? [];
  const drift = intelligence?.drift ?? [];
  const pending = autopilot?.recommendations.length ?? 0;

  return (
    <>
      <ScreenHeader
        title="Intelligence"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'Intelligence' }]}
      />
      <Screen>
        <Tabs defaultValue="quality">
          <TabsList>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="shadow">
              Shadow trackers{shadow.length > 0 ? ` (${shadow.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="drift">
              Drift{drift.length > 0 ? ` (${drift.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              Recommendations{pending > 0 ? ` (${pending})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quality">
            <QualityScore quality={quality} />
          </TabsContent>

          <TabsContent value="pages">
            <PageIntelligence pages={pages} />
          </TabsContent>

          <TabsContent value="shadow">
            <ShadowTrackers findings={shadow} />
          </TabsContent>

          <TabsContent value="drift">
            <DriftFindings findings={drift} />
          </TabsContent>

          <TabsContent value="recommendations">
            <Autopilot autopilot={autopilot} />
          </TabsContent>
        </Tabs>
      </Screen>
    </>
  );
}
