'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonSize, type ButtonVariant } from '@rift/ui';
import { runScan } from '@/app/actions';

/**
 * Scans a website Rift already knows about.
 *
 * The toast says "queued" rather than "scanning", because that is what has
 * actually happened: the row is written and a worker claims it when one is
 * free. If no worker is running the scan stays queued indefinitely, and a
 * message promising that scanning had begun would be the reason somebody spends
 * an afternoon looking for a fault in their website instead of in their
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
            await runScan(siteId);
            toast.success('Scan queued', {
              description: 'Progress appears here as pages are visited.',
            });
            router.refresh();
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
