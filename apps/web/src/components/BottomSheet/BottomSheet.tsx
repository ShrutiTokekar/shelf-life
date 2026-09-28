import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from '../icons';

export type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const SWIPE_CLOSE_PX = 80;

/**
 * Radix Dialog (SRS 7): focus trap, Escape closes. A sheet from the bottom on mobile (swipe the
 * handle down to close), a centered dialog on desktop.
 */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const startY = useRef<number | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[92dvh] flex-col rounded-t-[1.625rem] bg-cream outline-none lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-hero"
        >
          <div
            aria-hidden="true"
            className="flex touch-none justify-center pt-2.5 lg:hidden"
            onPointerDown={(e) => {
              startY.current = e.clientY;
            }}
            onPointerUp={(e) => {
              if (startY.current !== null && e.clientY - startY.current > SWIPE_CLOSE_PX) onClose();
              startY.current = null;
            }}
          >
            <span className="h-1.5 w-12 rounded-chip bg-line" />
          </div>
          <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-3 lg:pt-6">
            <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t('itemSheet.close')}
                className="flex size-11 items-center justify-center rounded-xl text-ink"
              >
                <CloseIcon size={22} />
              </button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
