import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from '../icons';

export type ToastInput = {
  message: string;
  /** e.g. { label: 'Undo', onAction } */
  action?: { label: string; onAction: () => void };
};

type ToastState = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const DURATION_MS = 5000;

/**
 * One toast at a time (SRS 7): role="status", 5 s, pauses while hovered or focused.
 * The live region is always mounted so screen readers announce new messages.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION_MS);
  const nextId = useRef(1);

  const show = useCallback((input: ToastInput) => {
    remaining.current = DURATION_MS;
    setToast({ ...input, id: nextId.current++ });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast || paused) return;
    const started = Date.now();
    const timer = setTimeout(dismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [toast, paused, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastView toast={toast} onDismiss={dismiss} onPause={setPaused} />
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
  onPause,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
  onPause: (p: boolean) => void;
}) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);

  // Pause the 5 s timer while the pointer or keyboard focus is on the toast (SRS 7).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const pause = () => onPause(true);
    const resume = () => onPause(false);
    const events = [
      ['mouseenter', pause],
      ['mouseleave', resume],
      ['focusin', pause],
      ['focusout', resume],
    ] as const;
    for (const [name, fn] of events) box.addEventListener(name, fn);
    return () => {
      for (const [name, fn] of events) box.removeEventListener(name, fn);
      onPause(false);
    };
  }, [toast, onPause]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[7.5rem] z-[80] flex justify-center px-4 lg:bottom-8"
    >
      {toast ? (
        <div
          key={toast.id}
          ref={boxRef}
          className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-card bg-ink py-1.5 pl-4 pr-1.5 text-white"
        >
          <p className="py-2 text-[0.9375rem]">{toast.message}</p>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action!.onAction();
                onDismiss();
              }}
              className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-periwinkle underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={t('toast.dismiss')}
            onClick={onDismiss}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-periwinkle"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
