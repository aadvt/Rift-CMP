"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a running scan's screen current, without inventing a second scan state.
 *
 * The dashboard reads the API with the organisation's secret key, which lives
 * on the server and must stay there — so the browser cannot poll
 * `GET /api/v1/scans/{id}` itself. Instead this asks Next to re-render the
 * server component, which re-fetches through the same server-side credential.
 * The status on screen is therefore always the status the database reported a
 * moment ago, and never a guess maintained in React.
 *
 * It stops as soon as the scan reaches a terminal state, so a completed scan
 * costs nothing.
 */
export function ScanPoller({
  active,
  intervalMs = 3000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
