import { Sidebar } from '@/components/shell/Sidebar';
import { MobileNav } from '@/components/shell/MobileNav';
import { listSites, getOrganisation } from '@/lib/api/endpoints';
import { currentSite } from '@/lib/current-site';
import { USE_FIXTURES } from '@/lib/api/client';
import { Icon } from '@rift/ui';

/**
 * Nothing under this layout is static.
 *
 * Every screen reads operational data — what a scan found, what a visitor
 * decided, whether the runtime is reporting — and a build-time snapshot of any
 * of that would be wrong before it finished deploying. Declaring it here rather
 * than per page means a new screen inherits the right behaviour instead of
 * discovering it as a prerender failure.
 */
export const dynamic = 'force-dynamic';


/**
 * The app shell. Everything else in the product lives inside this.
 * Sites are fetched once here and passed down, so the switcher and the
 * sidebar badge never fire their own requests.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // A fresh organisation has no websites at all, and the shell still has to
  // render — the screen that fixes that is inside it.
  const [sites, activeSite, organisation] = await Promise.all([
    listSites(),
    currentSite(),
    getOrganisation(),
  ]);

  return (
    <div className="flex min-h-screen bg-md-background">
      <Sidebar
        sites={sites}
        activeSite={activeSite}
        organisation={organisation}
        className="hidden md:flex"
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <MobileNav activeSite={activeSite} />
        {USE_FIXTURES ? <FixtureBanner /> : null}
        {children}
      </main>
    </div>
  );
}

/** Visible only while RIFT_API_URL is unset — impossible to ship by accident. */
function FixtureBanner() {
  return (
    <div className="mx-5 mt-3 flex items-center gap-3 rounded-full bg-md-warning-container px-5 py-2.5 text-label-medium text-md-on-warning-container md:mx-8">
      <Icon name="info" size={18} className="shrink-0" />
      <span>
        <strong className="font-medium">Fixture data.</strong> Set <code className="font-mono">RIFT_API_URL</code> in{' '}
        <code className="font-mono">apps/dashboard/.env.local</code> to connect the real backend.
      </span>
    </div>
  );
}
