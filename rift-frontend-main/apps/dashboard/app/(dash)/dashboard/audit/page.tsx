import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { Timeline } from '@/components/audit/Timeline';
import { AuthorisationCheck } from '@/components/audit/AuthorisationCheck';
import { getAuditTrail, getConfiguration } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Audit' };
export const dynamic = 'force-dynamic';

/**
 * The evidence surface.
 *
 * Two things an auditor asks, on one screen because they are the same question
 * from opposite ends. The timeline answers "show me what happened"; the check
 * answers "what would happen if I asked right now". Neither writes anything.
 *
 * Each read degrades on its own — an empty audit trail still leaves the check
 * usable, which is the state a brand-new site is actually in.
 */
export default async function AuditPage() {
  const siteId = await requireSiteId();
  const [entries, config] = await Promise.all([
    getAuditTrail(siteId),
    getConfiguration(siteId),
  ]);

  const purposes = config.consent.categories.map((c) => c.id);

  return (
    <>
      <ScreenHeader title="Audit" />
      <Screen>
        <div className="mb-5">
          <h2 className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-surface">
            What happened, and what is permitted now
          </h2>
          <p className="mt-2 max-w-[68ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Consent decisions, the authorisations that relied on them, and the transfers that
            followed — joined into one timeline. Below the check, ask whether an action is permitted
            without committing to it.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <AuthorisationCheck siteId={siteId} purposes={purposes} />
          <Timeline entries={entries} />
        </div>
      </Screen>
    </>
  );
}
