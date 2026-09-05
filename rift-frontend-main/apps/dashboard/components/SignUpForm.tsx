'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@rift/ui';
import { signUp } from '@/app/actions';

/**
 * Email, password, done.
 *
 * The twelve-character minimum is checked here so somebody learns it while
 * typing rather than after submitting, and again on the server, which is the
 * check that counts — this one is a courtesy and the server assumes nothing
 * about it.
 *
 * There is no "confirm password" field. It catches typos at the cost of asking
 * everybody to type the same thing twice, and a password reset catches the same
 * typos with no cost to the people who did not make one.
 */
export function SignUpForm({ className, website }: { className?: string; website: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.includes('@')) {
      setError('Enter the email address you want to sign in with.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters. Length is what makes a password hard to guess.');
      return;
    }

    setError(undefined);
    start(async () => {
      const result = await signUp({ email: email.trim(), password, website });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Straight to the running scan. Watching Rift work through the site is
      // the thing somebody just signed up to see, and a site page showing
      // nothing yet makes the product look like it did nothing.
      router.push(
        result.scanId
          ? `/dashboard/scans/${result.scanId}`
          : result.siteId
            ? `/dashboard/sites/${result.siteId}`
            : '/dashboard',
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(undefined);
          }}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 12 characters."
        {...(error ? { error } : {})}
        className="mt-4"
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          invalid={Boolean(error)}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(undefined);
          }}
        />
      </Field>

      <Button type="submit" variant="filled" size="lg" iconAfter="arrowRight" disabled={pending} className="mt-5">
        {pending ? 'Creating your account…' : 'Create account and scan'}
      </Button>
    </form>
  );
}
