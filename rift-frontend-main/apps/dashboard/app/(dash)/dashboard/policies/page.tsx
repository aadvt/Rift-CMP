import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { PolicyLibrary } from '@/components/policies/PolicyLibrary';
import { listNotices, listPolicies } from '@/lib/api/endpoints';

export const metadata = { title: 'Policies' };
export const dynamic = 'force-dynamic';

/**
 * The documents consent records point at.
 *
 * Organisation-scoped rather than per-site: a policy belongs to the account and
 * a version of it can be referenced by decisions on any of its websites, so
 * filing this under one site would misrepresent what it covers.
 *
 * Notices load beside policies rather than after them — a version without the
 * notice it produced is only half the record, and fetching them separately per
 * version would be one request per row for data that arrives in one call.
 */
export default async function PoliciesPage() {
  const [policies, notices] = await Promise.all([listPolicies(), listNotices()]);

  return (
    <>
      <ScreenHeader title="Policies" />
      <Screen>
        <div className="mb-5">
          <h2 className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
            What your visitors agreed to
          </h2>
          <p className="mt-2 max-w-[68ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Every consent record points at a policy version. These are those versions, the notices
            each one produced, and the purposes each notice disclosed — kept immutable so a decision
            made months ago can still be shown to mean what it meant.
          </p>
        </div>
        <PolicyLibrary policies={policies} notices={notices} />
      </Screen>
    </>
  );
}
