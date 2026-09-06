'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@rift/ui';
import { setTechnologyCategory } from '@/app/actions';

/**
 * Records "we are not deciding this yet" as a decision.
 *
 * It looks like a dismissal and is not one. In this product unresolved is a
 * real state with real consequences — the technology is not placed in a
 * category, is not blocked, and Rift makes no claim that it needs consent — so
 * choosing it deliberately is different from never having looked, and the write
 * is what records that difference.
 *
 * Sending `null` is the API's way of saying exactly that, which is why this
 * clears the category rather than setting one.
 */
export function LeaveUnresolvedButton({
  siteId,
  technologyId,
  name,
}: {
  siteId: string;
  technologyId: string;
  /** Shown in the confirmation, so the toast names the thing that changed. */
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="text"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await setTechnologyCategory(siteId, technologyId, null);
            toast('Left unresolved', {
              description: `${name} stays uncategorised. It is not blocked, and Rift has not claimed it needs consent.`,
            });
            router.refresh();
          } catch {
            toast.error('Could not save that', { description: 'Nothing was changed.' });
          }
        })
      }
    >
      {pending ? 'Saving…' : 'Leave unresolved'}
    </Button>
  );
}
