'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button, Field, Input } from '@rift/ui';
import { startScan } from '@/app/actions';

/** Zod validates operator input. It never validates API responses — that would
 *  put a second representation of the contract in the frontend. */
const schema = z
  .string()
  .trim()
  .min(1, 'Enter the website you want Rift to scan.')
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine((v) => { try { return Boolean(new URL(v).hostname.includes('.')); } catch { return false; } },
    'That doesn’t look like a website address. Try something like northwind-retail.com.');

export function NewSiteForm({ className, initialUrl = '' }: { className?: string; initialUrl?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialUrl);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the address and try again.');
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const { scanId } = await startScan(parsed.data);
      router.push(`/dashboard/scans/${scanId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <Field
        label="Website URL"
        htmlFor="site-url"
        hint="Rift scans the public pages it can reach from this address."
        {...(error ? { error } : {})}
      >
        <Input
          id="site-url"
          name="url"
          mono
          lead="sites"
          inputMode="url"
          autoComplete="url"
          placeholder="northwind-retail.com"
          value={value}
          invalid={Boolean(error)}
          onChange={(e) => setValue(e.currentTarget.value)}
          className="h-12 text-body-large"
        />
      </Field>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" variant="filled" size="lg" iconAfter="arrowRight" disabled={pending}>
          {pending ? 'Starting scan…' : 'Scan my website'}
        </Button>
        <span className="text-label-medium text-md-on-surface-variant/75">Usually takes 2–4 minutes</span>
      </div>
    </form>
  );
}
