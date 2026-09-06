import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { GraphWorkspace } from '@/components/graph/Workspace';
import { getConsentGraph } from '@/lib/api/endpoints';

export const metadata = { title: 'Data flow' };
export const dynamic = 'force-dynamic';

/**
 * The consent dependency graph and the simulator, on one screen.
 *
 * Together rather than apart, because the question that leads to a simulation is
 * always asked of something on the graph — "what happens if I block *this*" —
 * and sending an operator to another page to ask it loses the subject.
 */
export default async function GraphPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const graph = await getConsentGraph(siteId);

  return (
    <>
      <ScreenHeader
        title="Data flow"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: 'Data flow' }]}
      />
      <Screen>
        <GraphWorkspace siteId={siteId} graph={graph} />
      </Screen>
    </>
  );
}
