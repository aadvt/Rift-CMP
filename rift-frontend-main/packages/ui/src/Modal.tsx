'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** MD3 basic dialog — 28px radius, an icon above the headline, actions right
 *  aligned. Reserved for destructive or irreversible confirmations. */
export function ConfirmModal({
  open, onOpenChange, title, body, confirmLabel, onConfirm, destructive = true, icon = 'alert',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  icon?: IconName;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-md-inverse-surface/32 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-md-surface-high p-6 shadow-e4 focus:outline-none data-[state=open]:animate-[md-rise_300ms_var(--md-ease)]">
          <div className="mb-4 flex justify-center">
            <span className={destructive ? 'text-md-error' : 'text-md-primary'}>
              <Icon name={icon} size={24} />
            </span>
          </div>
          <Dialog.Title className="text-center text-title-large font-medium text-md-on-surface">{title}</Dialog.Title>
          <Dialog.Description className="mt-3 text-center text-body-medium leading-relaxed text-md-on-surface-variant">{body}</Dialog.Description>
          <div className="mt-7 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="text">Cancel</Button></Dialog.Close>
            <Button variant={destructive ? 'danger' : 'filled'} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
