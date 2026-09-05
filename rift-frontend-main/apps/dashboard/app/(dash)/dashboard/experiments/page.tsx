import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { ExperimentList } from '@/components/experiments/ExperimentList';
import { listExperiments } from '@/lib/api/endpoints';

export const metadata = { title: 'Experiments' };
export const dynamic = 'force-dynamic';

/**
 * Consent experiments across the organisation.
 *
 * Deliberately not scoped to the currently selected site: an operator running
 * one experiment per site wants to see all of them at once, and the site is on
 * every row anyway.
 */
export default async function ExperimentsPage() {
  const experiments = await listExperiments();

  return (
    <>
      <ScreenHeader
        title="Experiments"
        crumb={[{ label: 'Consent', href: '/dashboard/consent' }, { label: 'Experiments' }]}
      />
      <Screen>
        <ExperimentList experiments={experiments} />
      </Screen>
    </>
  );
}
