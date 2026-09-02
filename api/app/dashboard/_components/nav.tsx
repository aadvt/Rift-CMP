"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

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
  const reduced = useReducedMotion();

  return (
    <nav className="nav" aria-label="Dashboard sections">
      {LINKS.map((link) => {
        // Only the exact path is current, otherwise "Overview" would highlight
        // on every page because every path starts with /dashboard.
        const current = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className="nav-link"
          >
            {/*
             * A single element shared across items via `layoutId`, so the
             * highlight travels to the new section instead of blinking out and
             * in. It sits behind the label and is decorative, hence aria-hidden.
             */}
            {current && !reduced ? (
              <motion.span
                layoutId="nav-active"
                className="nav-active"
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              />
            ) : null}
            {current && reduced ? <span className="nav-active" aria-hidden="true" /> : null}
            <span className="nav-label">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
