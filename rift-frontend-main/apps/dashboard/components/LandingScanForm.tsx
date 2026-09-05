'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button, Field, Input } from '@rift/ui';

/**
 * The one field on the landing page.
 *
 * It does not scan anything. It validates the address and carries it to
 * sign-up, because a scan needs a site, a site needs an organisation, and an
 * organisation needs somebody to own it. Pretending otherwise would mean
 * creating anonymous records that either become orphans or quietly become
 * somebody's account without them saying so.
 *
 * What it does buy is that nobody retypes their own website address, and the
 * first screen after signing up is their site being scanned.
 */
const schema = z
  .string()
  .trim()
  .min(1, 'Enter the website you want Rift to scan.')
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine(
    (v) => {
      try {
        return Boolean(new URL(v).hostname.includes('.'));
      } catch {
        return false;
      }
    },
    'That doesn’t look like a website address. Try something like northwind-retail.com.',
  );

export function LandingScanForm({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the address and try again.');
      return;
    }
    setError(undefined);
    start(() => router.push(`/signup?website=${encodeURIComponent(parsed.data)}`));
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <Field label="Your website" htmlFor="website" {...(error ? { error } : {})}>
        <Input
          id="website"
          name="website"
          inputMode="url"
          autoComplete="url"
          placeholder="northwind-retail.com"
          value={value}
          invalid={Boolean(error)}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(undefined);
          }}
        />
      </Field>

      <Button type="submit" variant="filled" size="lg" iconAfter="arrowRight" disabled={pending} className="mt-4">
        {pending ? 'One moment…' : 'Scan my website'}
      </Button>
    </form>
  );
}
