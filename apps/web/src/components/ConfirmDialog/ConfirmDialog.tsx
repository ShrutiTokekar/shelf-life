import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { Button } from '../Button/Button';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: ReactNode;
};

/**
 * A destructive confirmation (HIS-5 Delete receipt). Radix Dialog with alertdialog semantics:
 * focus starts on the safe choice, Escape cancels.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  icon,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-hero bg-cream p-6 outline-none"
        >
          <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
          <Dialog.Description className="text-ink">{body}</Dialog.Description>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row-reverse">
            <Button variant="danger" fullWidth icon={icon} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Dialog.Close asChild>
              <Button ref={cancelRef} variant="secondary" fullWidth>
                {cancelLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
