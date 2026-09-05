'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from './cn';
import { Icon } from './Icon';

/**
 * Side sheet — finding detail, technology classification, consent-record
 * inspection. A row click opens this rather than navigating away.
 *
 * MD3 gives side sheets a large radius on their leading edge only, so the
 * panel reads as sliding in from the screen edge. Radix handles focus
 * trapping, focus restore and Escape.
 */
export function Drawer({
  open, onOpenChange, eyebrow, title, sub, footer, children, width = 480,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-md-inverse-surface/32 backdrop-blur-[2px] data-[state=open]:animate-[md-fade_300ms_var(--md-ease)]" />
        <Dialog.Content
          style={{ width }}
          className={cn(
            'fixed inset-y-2 right-2 z-50 flex max-w-[calc(100vw-16px)] flex-col overflow-hidden',
            'rounded-2xl bg-md-surface-low shadow-e4',
            'data-[state=open]:animate-[md-slide-in_400ms_var(--md-ease)]',
            'focus:outline-none',
          )}
        >
          <div className="relative flex items-start gap-3 bg-md-surface-container px-6 pb-5 pt-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-md-primary-container/60 blur-3xl" />
            <div className="relative min-w-0 flex-1">
              {eyebrow ? (
                <div className="mb-2 text-label-small font-medium uppercase tracking-[0.06em] text-md-on-surface-variant">{eyebrow}</div>
              ) : null}
              <Dialog.Title className="text-title-large font-medium leading-tight text-md-on-surface">{title}</Dialog.Title>
              {sub ? <div className="mt-3 flex flex-wrap items-center gap-2">{sub}</div> : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-all duration-[--md-duration-fast] ease-md hover:bg-md-primary/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
            >
              <Icon name="x" size={20} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">{children}</div>

          {footer ? (
            <div className="flex items-center gap-3 bg-md-surface-container px-6 py-4">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-3 text-label-small font-medium uppercase tracking-[0.06em] text-md-on-surface-variant">{title}</div>
      {children}
    </div>
  );
}

export function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 py-2.5">
      <span className="w-[128px] shrink-0 text-label-medium text-md-on-surface-variant">{label}</span>
      <span className="min-w-0 flex-1 text-body-medium text-md-on-surface">{children}</span>
    </div>
  );
}
