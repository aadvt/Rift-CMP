'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@rift/ui';
import { stopScan } from '@/app/actions';

/**
 * Stops a scan in progress.
 *
 * It confirms first. Cancelling is not destructive — nothing already found is
 * discarded — but a scan takes minutes and starting again means waiting them
 * out a second time, so an accidental click has a real cost and the button sits
 * next to nothing else on the header.
 *
 * The confirmation is a second click on the same control rather than a modal.
 * The whole interaction is "are you sure", the answer is one word, and a dialog
 * for that is heavier than the decision it guards.
 *
 * It does not wait for the crawler to actually stop. The platform cancels
 * cooperatively — a running crawl notices at its next page boundary — so the
 * button reports that the request landed, and the status on this page changes
 * when the worker gets there. Claiming it had stopped would be a sentence this
 * component cannot check.
 */
export function CancelScanButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [armed, setArmed] = React.useState(false);
  const [pending, start] = React.useTransition();

  // Disarms itself, so a button left in its confirming state does not stay
  // there waiting to catch somebody who has moved on and come back.
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      variant={armed ? 'filled' : 'outlined'}
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        start(async () => {
          const result = await stopScan(scanId);
          if (!result.ok) {
            toast.error('Could not cancel the scan', {
              description: 'It is still running. Try again in a moment.',
            });
            return;
          }
          toast.success('Cancelling', {
            description:
              result.message ??
              'The scan stops at its next page. Everything found so far is kept.',
          });
          router.refresh();
        });
      }}
    >
      {pending ? 'Cancelling…' : armed ? 'Confirm cancel' : 'Cancel scan'}
    </Button>
  );
}
