import * as React from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

export function Field({
  label, hint, error, optional, htmlFor, children, className,
}: {
  label: string; hint?: string; error?: string; optional?: boolean;
  htmlFor?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-label-medium font-medium text-md-on-surface">
        {label}
        {optional ? <span className="ml-2 font-normal text-md-on-surface-variant">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-2 flex items-center gap-1.5 px-4 text-label-small text-md-error">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 px-4 text-label-small text-md-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Material 3 filled text field.
 *
 * The distinctive shape: rounded top corners, square bottom, a tonal fill,
 * and a 2px bottom rule that turns primary on focus. Tall — 56px — so the
 * touch target is generous.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  lead?: IconName;
  trail?: React.ReactNode;
  invalid?: boolean;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { lead, trail, invalid, mono, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        'group flex h-14 items-center gap-3 rounded-t-sm border-b-2 bg-md-surface-variant px-4',
        'transition-colors duration-[--md-duration-fast] ease-md',
        'focus-within:border-md-primary focus-within:bg-md-surface-high',
        'focus-within:ring-2 focus-within:ring-md-primary/20',
        invalid ? 'border-md-error' : 'border-md-outline',
        className,
      )}
    >
      {lead ? (
        <Icon
          name={lead}
          size={20}
          className={cn('shrink-0 transition-colors', invalid ? 'text-md-error' : 'text-md-on-surface-variant group-focus-within:text-md-primary')}
        />
      ) : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-body-medium text-md-on-surface outline-none',
          'placeholder:text-md-on-surface-variant/70',
          mono && 'font-mono',
        )}
        {...rest}
      />
      {trail ? <div className="shrink-0">{trail}</div> : null}
    </div>
  );
});
