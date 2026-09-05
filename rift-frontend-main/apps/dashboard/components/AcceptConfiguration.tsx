'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonSize } from '@rift/ui';
import { useRiftConfiguration } from '@/app/actions';

/** The automated path is always the filled button. */
export function AcceptConfiguration({ siteId, size = 'md' }: { siteId: string; size?: ButtonSize }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      variant="filled"
      size={size}
      icon="check"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { version } = await useRiftConfiguration(siteId);
          toast.success('Configuration applied', { description: `${version} is now live for this site.` });
          router.push('/dashboard/install');
        })
      }
    >
      {pending ? 'Applying…' : 'Use Rift configuration'}
    </Button>
  );
}
