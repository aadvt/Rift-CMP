"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Primary navigation.
 *
 * The order is the product's story: what is happening, what is running on the
 * page, who agreed to what, what moved as a result, how the site is performing,
 * and how to wire it up.
 */
const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/discovery", label: "Discovery" },
  { href: "/dashboard/consent", label: "Consent" },
  { href: "/dashboard/transfers", label: "Transfers" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/integration", label: "Integration" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Dashboard sections">
      {LINKS.map((link) => {
        // Only the exact path is current, otherwise "Overview" would highlight
        // on every page because every path starts with /dashboard.
        const current = pathname === link.href;
        return (
          <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
