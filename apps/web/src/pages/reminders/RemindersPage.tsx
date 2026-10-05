import {
  formatAmount,
  markRead,
  putOff,
  type Reminder,
  type ReminderState,
} from '@shelf-life/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ClaimPill } from '../../components/ClaimPill/ClaimPill';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ChevronLeftIcon, EmptyJarIcon, JarIcon } from '../../components/icons';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { useToast } from '../../components/Toast/Toast';
import { useReminders } from '../../features/reminders/useReminders';
import { cx } from '../../lib/cx';
import { usePeople } from '../../lib/people';
import { useMe } from '../../lib/session';
import { usePantryActions } from '../pantry/usePantryActions';

/**
 * Reminders (SRS 6.10, Figma mobile 11): what ran out (Add to list / Later / Not needed) and what
 * is running low (Add to list / Snooze); things already on a list show who's getting them
 * (RMD-3). Unread ones have a terra dot; Mark all read clears them (RMD-2). Built from this
 * device's pantry copy, so it works offline. Push notifications and their settings come in 8c.
 */
export function RemindersPage() {
  const { t } = useTranslation();
  const me = useMe();
  const toast = useToast();
  const r = useReminders();
  const actions = usePantryActions({
    doc: r.doc,
    pantryId: r.pantry.id,
    userId: me.user.id,
    today: r.today,
    lists: r.lists,
  });
  const canEdit = r.pantry.canEdit;
  const all = [...r.ranOut, ...r.low];

  if (r.status === 'loading') return <PageSkeleton />;

  /** Change this person's reminder state, with Undo. */
  function choose(next: (s: ReminderState) => ReminderState, message: string) {
    let before: ReminderState | null = null;
    r.update((s) => {
      before = s;
      return next(s);
    });
    toast({
      message,
      action: {
        label: t('reminders.toast.undo'),
        onAction: () => {
          if (before) r.update(() => before!);
        },
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 page-x pb-8 pt-5 lg:pt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label={t('reminders.back')}
            className="-ml-2 inline-flex size-11 items-center justify-center rounded-xl text-ink lg:hidden"
          >
            <ChevronLeftIcon size={24} />
          </Link>
          <h1 className="text-[2rem] leading-tight lg:text-[3.5rem]">{t('reminders.title')}</h1>
        </div>
        {r.unread > 0 ? (
          <button
            type="button"
            onClick={() => {
              r.update((s) =>
                markRead(
                  s,
                  all.map((x) => x.key),
                ),
              );
              toast({ message: t('reminders.toast.allRead') });
            }}
            className="inline-flex min-h-11 items-center rounded-xl px-2 font-semibold text-navy"
          >
            {t('reminders.markAll')}
          </button>
        ) : null}
      </div>

      {r.status === 'error' ? (
        <ErrorState message={t('reminders.error')} onRetry={r.retry} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<JarIcon size={32} />}
          title={t('reminders.emptyTitle')}
          body={t('reminders.emptyBody')}
          action={
            <Button asChild>
              <Link to="/pantry">{t('reminders.emptyAction')}</Link>
            </Button>
          }
        />
      ) : (
        <div id="reminders" tabIndex={-1} className="flex flex-col gap-6 outline-none">
          {!canEdit ? <p className="text-sm text-secondary">{t('reminders.viewOnly')}</p> : null}
          {(
            [
              ['ran-out', t('reminders.ranOut'), r.ranOut],
              ['low', t('reminders.low'), r.low],
            ] as const
          ).map(([id, title, list]) =>
            list.length ? (
              <section key={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-3">
                <h2
                  id={`${id}-h`}
                  className="font-ui text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-secondary"
                >
                  {title}
                </h2>
                <ul className="flex flex-col gap-3">
                  {list.map((rem) => (
                    <ReminderCard
                      key={rem.key}
                      reminder={rem}
                      canEdit={canEdit}
                      onAdd={() => {
                        r.update((s) => markRead(s, [rem.key]));
                        void actions.addToList(rem.item);
                      }}
                      onLater={() =>
                        choose(
                          (s) => putOff(s, rem.key, 'later', r.today),
                          t('reminders.toast.later', { name: rem.item.name }),
                        )
                      }
                      onNotNeeded={() =>
                        choose(
                          (s) => putOff(s, rem.key, 'never', r.today),
                          t('reminders.toast.notNeeded', { name: rem.item.name }),
                        )
                      }
                      onSnooze={() =>
                        choose(
                          (s) => putOff(s, rem.key, 'snooze', r.today),
                          t('reminders.toast.snoozed', { name: rem.item.name }),
                        )
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function ReminderCard({
  reminder: rem,
  canEdit,
  onAdd,
  onLater,
  onNotNeeded,
  onSnooze,
}: {
  reminder: Reminder;
  canEdit: boolean;
  onAdd: () => void;
  onLater: () => void;
  onNotNeeded: () => void;
  onSnooze: () => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const people = usePeople(me);
  const titleId = useId();
  const { item } = rem;
  const name = (id: string) => people.get(id)?.name.split(' ')[0] ?? '';

  let detail: string;
  if (rem.kind === 'ran_out') {
    const when =
      rem.daysAgo === 0
        ? t('reminders.ranOutToday')
        : rem.daysAgo === 1
          ? t('reminders.ranOutYesterday')
          : t('reminders.ranOutDays', { count: rem.daysAgo ?? 0 });
    const who =
      rem.by === me.user.id
        ? t('reminders.byYou')
        : rem.by && name(rem.by)
          ? t('reminders.by', { name: name(rem.by) })
          : null;
    detail = [when, who].filter(Boolean).join(' · ');
  } else {
    const amount =
      item.quantity !== null ? `${formatAmount(item.quantity)} ${item.unit}`.trim() : '';
    detail = item.lowAt || !amount ? t('reminders.marked') : t('reminders.left', { amount });
  }

  const claimer = rem.listItem?.claimedBy
    ? {
        ...(people.get(rem.listItem.claimedBy) ?? {
          name: '?',
          initial: '?',
          tone: 'peach' as const,
        }),
        isYou: rem.listItem.claimedBy === me.user.id,
      }
    : null;

  return (
    <li
      aria-labelledby={titleId}
      data-testid="reminder"
      className="flex flex-col gap-3 rounded-hero bg-white p-4 bordered"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'flex size-12 shrink-0 items-center justify-center rounded-xl',
            rem.kind === 'ran_out' ? 'bg-terra-light text-terra-dark' : 'bg-peach text-peach-dark',
          )}
        >
          {rem.kind === 'ran_out' ? <EmptyJarIcon size={24} /> : <JarIcon size={24} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="font-ui text-lg font-semibold [overflow-wrap:anywhere]">
            {item.name}
            {rem.unread && !rem.listItem ? (
              <span className="sr-only">{`, ${t('reminders.unread')}`}</span>
            ) : null}
          </h3>
          <p className="text-sm text-secondary">{detail}</p>
        </div>
        {rem.unread && !rem.listItem ? (
          <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-terra" />
        ) : null}
      </div>
      {rem.listItem ? (
        // RMD-3: someone's on it (or it's at least on the list).
        <ClaimPill claimer={claimer} className="self-start" />
      ) : canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onAdd}
            aria-label={t('reminders.addToListLabel', { name: item.name })}
          >
            {t('reminders.addToList')}
          </Button>
          {rem.kind === 'ran_out' ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={onLater}
                aria-label={t('reminders.laterLabel', { name: item.name })}
              >
                {t('reminders.later')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onNotNeeded}
                aria-label={t('reminders.notNeededLabel', { name: item.name })}
              >
                {t('reminders.notNeeded')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={onSnooze}
              aria-label={t('reminders.snoozeLabel', { name: item.name })}
            >
              {t('reminders.snooze')}
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
