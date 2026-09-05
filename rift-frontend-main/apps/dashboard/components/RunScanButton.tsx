'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonSize, type ButtonVariant } from '@rift/ui';
import { runScan } from '@/app/actions';

/**
 * Scans a website Rift already knows about.
 *
 * On success it goes to the scan's own page, where the stages appear one by
 * one. That screen shows "queued" until a worker claims the row, which is the
 * honest state: if no worker is running the scan stays queued indefinitely, and
 * a message promising that scanning had begun would be the reason somebody
 * spends an afternoon looking for a fault in their website instead of in their
 * deployment.
 */
export function RunScanButton({
  siteId,
  size = 'md',
  variant = 'filled',
  children = 'Run scan now',
}: {
  siteId: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      icon="scans"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const { scanId } = await runScan(siteId);
            // To the scan itself, not back to a list. The stage-by-stage view is
            // the only place the work is visible while it happens.
            router.push(`/dashboard/scans/${scanId}`);
          } catch {
            toast.error('Could not start the scan', {
              description: 'Nothing was queued. Try again in a moment.',
            });
          }
        })
      }
    >
      {pending ? 'Queueing…' : children}
    </Button>
  );
}
