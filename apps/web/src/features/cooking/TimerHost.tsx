import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CloseIcon, ClockIcon } from '../../components/icons';
import { useTimers } from '../../stores/timers';

/** Ask once, the first time someone starts a timer (SRS 8.10). Never on page load. */
export async function askToNotify(): Promise<void> {
  try {
    if ('Notification' in window && Notification.permission === 'default')
      await Notification.requestPermission();
  } catch {
    // Not available (e.g. iOS outside the home screen app): the in-app alert still works.
  }
}

async function notify(title: string, body: string, tag: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png' });
    else new Notification(title, { body, tag });
  } catch {
    // Best effort: the in-app alert below is the one that always shows.
  }
}

/**
 * Watches running step timers app-wide (RCP-5, RCP-7). When one ends: an in-app alert you can
 * dismiss, a vibration, and a notification if the app is in the background. Timers that ended
 * while the phone was asleep alert as soon as the app is opened again.
 */
export function TimerHost() {
  const { t } = useTranslation();
  const timers = useTimers((s) => s.timers);
  const finish = useTimers((s) => s.finish);
  const dismiss = useTimers((s) => s.dismiss);
  const [now, setNow] = useState(() => Date.now());

  const running = Object.values(timers).some((x) => x.endsAt !== null);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    for (const timer of Object.values(timers)) {
      if (timer.endsAt === null || timer.endsAt > now) continue;
      finish(timer.id);
      const body = t('cook.timer.doneBody', { step: timer.stepTitle, recipe: timer.recipeTitle });
      try {
        navigator.vibrate?.([300, 150, 300]);
      } catch {
        // ignore
      }
      if (document.visibilityState === 'hidden')
        void notify(t('cook.timer.doneTitle'), body, timer.id);
    }
  }, [now, timers, finish, t]);

  const done = Object.values(timers).filter((x) => x.done);
  if (done.length === 0) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-50 flex flex-col gap-2 lg:left-auto lg:w-96">
      {done.map((timer) => (
        <div
          key={timer.id}
          role="alert"
          className="flex items-center gap-3 rounded-card border-2 border-navy bg-white p-4 shadow-lg"
        >
          <ClockIcon size={24} className="shrink-0 text-navy" />
          <p className="min-w-0 flex-1">
            <span className="block font-semibold">{t('cook.timer.doneTitle')}</span>
            <Link
              to={`/recipes/${encodeURIComponent(timer.recipeId)}/cook?step=${timer.step + 1}`}
              className="text-sm text-navy underline"
            >
              {t('cook.timer.doneBody', { step: timer.stepTitle, recipe: timer.recipeTitle })}
            </Link>
          </p>
          <button
            type="button"
            onClick={() => dismiss(timer.id)}
            aria-label={t('cook.timer.dismiss')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
          >
            <CloseIcon size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
