'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@rift/ui';
import { signIn } from '@/app/actions';

/**
 * Email and password.
 *
 * One message for every failure, and deliberately so: telling somebody that an
 * address exists but the password was wrong answers the first question a
 * credential-stuffing run has, and this form has no reason to.
 *
 * The error appears beside the field rather than after a redirect, so a wrong
 * password does not also throw away the email that was typed with it.
 */
export function SignInForm({ className }: { className?: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError(undefined);
    start(async () => {
      const result = await signIn({ email: email.trim(), password });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push('/dashboard');
      // The dashboard is a server component and its data was fetched without a
      // session. Without this it renders from that cache and looks signed out.
      router.refresh();
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

      <Field label="Password" htmlFor="password" {...(error ? { error } : {})} className="mt-4">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          invalid={Boolean(error)}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(undefined);
          }}
        />
      </Field>

      <Button type="submit" variant="filled" size="lg" iconAfter="arrowRight" disabled={pending} className="mt-5">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
