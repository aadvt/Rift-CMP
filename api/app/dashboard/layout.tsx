import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { readSessionKey, clearSessionKey } from "@/lib/dashboard/session";
import { apiGet } from "@/lib/dashboard/api";
import type { OrganisationSummary } from "@rift-cmp/shared";
import { DashboardNav } from "./_components/nav";

export const metadata = { title: "Dashboard · Rift-CMP" };

async function signOut() {
  "use server";
  await clearSessionKey();
  redirect("/signin");
}

/**
 * The dashboard shell, and the only place sign-in is enforced.
 *
 * Note that this guard is convenience, not security: the platform API
 * authenticates every request independently, so reaching a page without a valid
 * key would still render nothing. The redirect just avoids showing an operator
 * a wall of authentication errors.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!(await readSessionKey())) {
    redirect("/signin");
  }

  const organisation = await apiGet<OrganisationSummary>("/api/v1/organisation");
  if (!organisation.ok && organisation.status === 401) {
    // The key was revoked or the cookie is stale.
    redirect("/signin?error=invalid");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Rift-CMP
          <small>{organisation.ok ? organisation.data.name : "Organisation"}</small>
        </div>

        <DashboardNav />

        <div className="sidebar-foot">
          <form action={signOut}>
            <button type="submit" style={{ width: "100%" }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
