import { EXPIRY_ALERTS, type ExpiryAlert, type NotificationSettings } from '@shelf-life/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOffIcon, BellIcon } from '../../components/icons';
import { Select } from '../../components/Select/Select';
import { Switch } from '../../components/Switch/Switch';
import { patchSettings } from '../../lib/api';
import { cx } from '../../lib/cx';
import { disablePush, enablePush, pushEnabledHere, pushSupport } from '../../lib/push';
import { useMe, useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const TIMES = ['08:00', '09:00', '10:00', '12:00', '17:00', '18:00', '19:00', '20:00'] as const;

/** Notification settings from the account, changed optimistically and saved (PRO-5). */
function useNotificationSettings() {
  const me = useMe();
  const session = useSession();
  const [local, setLocal] = useState<NotificationSettings>(() => ({
    notifyRanOut: me.settings.notifyRanOut,
    expiryAlert: me.settings.expiryAlert,
    weeklyReminder: me.settings.weeklyReminder,
    weeklyDay: me.settings.weeklyDay,
    weeklyTime: me.settings.weeklyTime,
    timeZone: me.settings.timeZone,
  }));
  const [failed, setFailed] = useState(false);
  const update = (patch: Partial<NotificationSettings>) => {
    const before = local;
    setLocal({ ...local, ...patch });
    setFailed(false);
    void patchSettings(patch)
      .then(() => session.refresh())
      .catch(() => {
        setLocal(before);
        setFailed(true);
      });
  };
  return { settings: local, update, failed };
}

/** This device's push state: on/off, and whether it can be on at all (SRS 8.8). */
function useDevicePush() {
  const [support] = useState(pushSupport);
  const [on, setOn] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<'denied' | 'unavailable' | null>(null);
  useEffect(() => {
    let live = true;
    void pushEnabledHere().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  const toggle = async (next: boolean) => {
    setProblem(null);
    if (!next) {
      await disablePush();
      setOn(false);
      return;
    }
    try {
      const result = await enablePush();
      if (result === 'on') setOn(true);
      else setProblem(result);
    } catch {
      setProblem('unavailable');
    }
  };
  return { support, on, problem, toggle };
}

/**
 * PRO-5 notifications (Figma 12, web 15), and RMD-1's quick settings on Reminders (`compact`):
 * notifications on this device, "when something runs out", expiry alert timing and the weekly
 * shopping reminder. Quiet hours (10 PM to 8 AM) always apply. Without push (unsupported, iPhone
 * not on the Home Screen, blocked) reminders stay in the app, and the card says how to fix it.
 */
export function NotificationsCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const online = useOnlineStatus();
  const { settings, update, failed } = useNotificationSettings();
  const device = useDevicePush();
  const home = me.lists.find((l) => l.isHome && l.pantryId === me.pantry?.id)?.name ?? '';
  const day = (d: number) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2026, 9, 4 + d));
  const time = (hhmm: string) =>
    new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(`2026-10-05T${hhmm}:00`),
    );

  const deviceHint =
    device.support === 'ios-install'
      ? t('notifications.device.ios')
      : device.support === 'unsupported'
        ? t('notifications.device.unsupported')
        : device.support === 'denied' || device.problem === 'denied'
          ? t('notifications.device.denied')
          : device.problem === 'unavailable'
            ? t('notifications.device.unavailable')
            : t('notifications.device.hint');
  const deviceUsable = device.support === 'supported' && online && device.on !== null;

  return (
    <section
      aria-labelledby={compact ? 'notif-quick' : 'notifications'}
      className={cx('flex flex-col rounded-hero bg-white bordered', compact ? 'p-4' : 'p-5 lg:p-6')}
    >
      <h2
        id={compact ? 'notif-quick' : 'notifications'}
        className={cx(
          'flex items-center gap-2.5',
          compact ? 'font-ui text-base font-semibold' : 'text-[1.375rem] lg:text-[1.625rem]',
        )}
      >
        <BellIcon size={compact ? 18 : 22} className="text-navy" />
        {compact ? t('notifications.quick') : t('notifications.title')}
      </h2>
      <div className="mt-2 flex flex-col divide-y-2 divide-line">
        <Switch
          label={t('notifications.device.label')}
          hint={deviceHint}
          checked={!!device.on}
          disabled={!deviceUsable}
          onChange={(v) => void device.toggle(v)}
        />
        <Switch
          label={t('notifications.ranOut')}
          hint={t('notifications.ranOutHint', { list: home })}
          checked={settings.notifyRanOut}
          disabled={!online}
          onChange={(v) => update({ notifyRanOut: v })}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold">{t('notifications.expiry')}</p>
            <p className="text-sm text-secondary">{t('notifications.expiryHint')}</p>
          </div>
          <Select
            label={t('notifications.expiry')}
            inline
            value={settings.expiryAlert}
            onChange={(v) => update({ expiryAlert: v as ExpiryAlert })}
            options={EXPIRY_ALERTS.map((a) => ({
              value: a,
              label: t(`notifications.alerts.${a}`),
            }))}
          />
        </div>
        {!compact ? (
          <div className="flex flex-col">
            <Switch
              label={t('notifications.weekly')}
              hint={
                settings.weeklyReminder
                  ? t('notifications.weeklyWhen', {
                      day: day(settings.weeklyDay),
                      time: time(settings.weeklyTime),
                    })
                  : t('notifications.weeklyHint')
              }
              checked={settings.weeklyReminder}
              disabled={!online}
              onChange={(v) => update({ weeklyReminder: v })}
            />
            {settings.weeklyReminder ? (
              <div className="grid gap-3 pb-3 sm:grid-cols-2">
                <Select
                  label={t('notifications.day')}
                  value={String(settings.weeklyDay)}
                  onChange={(v) => update({ weeklyDay: Number(v) })}
                  options={DAYS.map((d) => ({ value: String(d), label: day(d) }))}
                />
                <Select
                  label={t('notifications.time')}
                  value={settings.weeklyTime}
                  onChange={(v) => update({ weeklyTime: v })}
                  options={
                    (TIMES as readonly string[]).includes(settings.weeklyTime)
                      ? TIMES.map((x) => ({ value: x, label: time(x) }))
                      : [settings.weeklyTime, ...TIMES].map((x) => ({ value: x, label: time(x) }))
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-secondary">{t('notifications.quiet')}</p>
      {!online || failed ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-ink">
          <CloudOffIcon size={18} />
          {failed ? t('notifications.failed') : t('notifications.offline')}
        </p>
      ) : null}
    </section>
  );
}
