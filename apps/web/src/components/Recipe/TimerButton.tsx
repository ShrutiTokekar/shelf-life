import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { askToNotify } from '../../features/cooking/TimerHost';
import { cx } from '../../lib/cx';
import { clock, remaining, timerId, useTimers } from '../../stores/timers';
import { ClockIcon } from '../icons';

/**
 * RCP-5 timer button: "Start 2:00 timer", then a live countdown that pauses and resumes. The
 * countdown text isn't announced every second; the end is (TimerHost's alert).
 */
export function TimerButton({
  recipeId,
  recipeTitle,
  step,
  stepTitle,
  seconds,
  large = false,
}: {
  recipeId: string;
  recipeTitle: string;
  step: number;
  stepTitle: string;
  seconds: number;
  large?: boolean;
}) {
  const { t } = useTranslation();
  const timer = useTimers((s) => s.timers[timerId(recipeId, step)]);
  const { start, pause, resume } = useTimers.getState();
  const [now, setNow] = useState(() => Date.now());
  const running = !!timer && timer.endsAt !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const base = cx(
    'inline-flex items-center gap-1.5 self-start rounded-chip font-semibold',
    large ? 'min-h-12 px-5 text-lg' : 'min-h-11 px-3.5 text-sm',
  );

  if (!timer || timer.done)
    return (
      <button
        type="button"
        className={cx(base, 'bg-apricot text-apricot-dark')}
        onClick={() => {
          void askToNotify();
          start({ recipeId, recipeTitle, step, stepTitle, durationMs: seconds * 1000 });
          setNow(Date.now());
        }}
      >
        <ClockIcon size={large ? 20 : 16} />
        {t('cook.timer.start', { time: clock(seconds * 1000) })}
      </button>
    );

  const left = clock(remaining(timer, now));
  return (
    <button
      type="button"
      aria-label={
        running
          ? t('cook.timer.pauseLabel', { time: left, step: stepTitle })
          : t('cook.timer.resumeLabel', { time: left, step: stepTitle })
      }
      className={cx(base, running ? 'bg-navy text-white' : 'bg-white text-navy bordered')}
      onClick={() => (running ? pause(timer.id) : resume(timer.id))}
    >
      <ClockIcon size={large ? 20 : 16} />
      <span className="tabular-nums">{left}</span>
      <span aria-hidden="true">· {running ? t('cook.timer.pause') : t('cook.timer.resume')}</span>
    </button>
  );
}
