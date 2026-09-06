import { Notice } from '@rift/ui';
import { Screen, ScreenHeader } from '@/components/shell/ScreenHeader';
import { RightsQueue } from '@/components/rights/RightsQueue';
import { ExportReportButton } from '@/components/ExportReportButton';
import { listRightsRequests } from '@/lib/api/endpoints';
import type { RightsRequest } from '@/lib/api/endpoints';

export const metadata = { title: 'Rights requests' };
export const dynamic = 'force-dynamic';

/**
 * Access, deletion and objection requests.
 *
 * The public plane has accepted these since the rights work landed. Until this
 * screen they arrived in the database and nowhere else — a statutory clock
 * running in a table nobody looked at.
 *
 * A failed fetch is reported rather than degraded to an empty list. Everywhere
 * else in this app a missing read costs a panel; here "no requests" and "we
 * could not read your requests" have completely different consequences, and
 * showing the reassuring one when the truth is the other is the specific
 * failure this screen must not have.
 */
export default async function RightsPage() {
  let requests: RightsRequest[] | null = null;
  try {
    requests = await listRightsRequests();
  } catch {
    requests = null;
  }

  return (
    <>
      <ScreenHeader
        title="Rights requests"
        actions={requests && requests.length > 0 ? <ExportReportButton /> : undefined}
      />
      <Screen>
        <div data-print-region>
          {requests === null ? (
            <Notice tone="error" icon="alert" title="Rift could not read your rights requests">
              This is not the same as having none. Requests may be waiting, and their response
              windows may be running. Reload, and if this persists check that the Rift API is
              reachable before assuming the queue is empty.
            </Notice>
          ) : (
            <RightsQueue requests={requests} />
          )}
        </div>
      </Screen>
    </>
  );
}
