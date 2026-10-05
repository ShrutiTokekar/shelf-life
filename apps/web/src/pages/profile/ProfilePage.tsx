import { readActivity } from '@shelf-life/docs';
import { impactStats, todayIso, type Activity } from '@shelf-life/shared';
import { useId, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import { AvatarStack } from '../../components/AvatarStack/AvatarStack';
import { BottomSheet } from '../../components/BottomSheet/BottomSheet';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  CheckIcon,
  ChevronRightIcon,
  CloudOffIcon,
  DownloadIcon,
  EditIcon,
  LeafIcon,
  LockIcon,
  PlusIcon,
  PotIcon,
  ReceiptIcon,
  TrashIcon,
  UserPlusIcon,
} from '../../components/icons';
import { listDotClass } from '../../components/PantryLabel/PantryLabel';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Switch } from '../../components/Switch/Switch';
import { useToast } from '../../components/Toast/Toast';
import { RecipePrefsCard } from '../../features/recipes/RecipePrefsCard';
import { deleteAccount, downloadMyData, signOut, updateProfile } from '../../lib/api';
import { cx } from '../../lib/cx';
import { usePeople } from '../../lib/people';
import { useMe, useSession } from '../../lib/session';
import { useDocSnapshot, useListsItems, useReceipts } from '../../lib/sync/useDocs';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { wipeDeviceData } from '../../lib/wipe';
import { useUiSettings } from '../../stores/uiSettings';

const NO_ACTIVITY: Activity[] = [];

/** A profile card: rounded, bordered, with an icon heading (Figma 12, web 15). */
function Card({
  id,
  icon,
  title,
  children,
  className,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cx('flex flex-col rounded-hero bg-white p-5 bordered lg:p-6', className)}
    >
      <h2 id={id} className="flex items-center gap-2.5 text-[1.375rem] lg:text-[1.625rem]">
        <span className="text-navy">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Profile (SRS 6.11, Figma mobile 12, web 15): who you are and your impact, Lists & people, what
 * the AI should know, display and accessibility, privacy and account. Notification settings
 * (PRO-5) join with Web Push in Milestone 8c. Everything but sign-out, download and delete works
 * offline.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 page-x py-6 lg:py-8">
      <h1 className="sr-only">{t('profile.title')}</h1>
      <Hero />
      <div
        id="settings"
        tabIndex={-1}
        className="grid gap-6 outline-none lg:grid-cols-2 lg:items-start"
      >
        <div className="flex flex-col gap-6">
          <ListsCard />
          <RecipePrefsCard />
        </div>
        <div className="flex flex-col gap-6">
          <DisplayCard />
          <PrivacyCard />
        </div>
      </div>
    </div>
  );
}

/** PRO-1: avatar, name, email, home list, join date, Edit profile and impact stats. */
function Hero() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const { receipts, doc, status } = useReceipts(me.pantry?.id ?? null);
  const activity = useDocSnapshot(doc, readActivity, NO_ACTIVITY);
  const [editing, setEditing] = useState(false);
  const stats = useMemo(
    () => impactStats(activity, receipts, me.user.id, todayIso().slice(0, 7)),
    [activity, receipts, me.user.id],
  );
  const home = me.lists.find((l) => l.isHome && l.ownerId === me.user.id);
  const joined = new Intl.DateTimeFormat(i18n.language, { month: 'short', year: 'numeric' }).format(
    new Date(me.user.createdAt),
  );
  const tiles = [
    {
      key: 'saved',
      icon: <LeafIcon size={20} />,
      n: stats.savedThisMonth,
      label: t('profile.stats.saved', { count: stats.savedThisMonth }),
      tone: 'bg-sage text-olive-dark',
    },
    {
      key: 'receipts',
      icon: <ReceiptIcon size={20} />,
      n: stats.receiptsScanned,
      label: t('profile.stats.receipts', { count: stats.receiptsScanned }),
      tone: 'bg-periwinkle text-ink',
    },
    {
      key: 'cooked',
      icon: <PotIcon size={20} />,
      n: stats.recipesCooked,
      label: t('profile.stats.cooked', { count: stats.recipesCooked }),
      tone: 'bg-peach text-peach-dark',
    },
  ];
  return (
    <section
      aria-label={me.user.displayName}
      className="flex flex-col items-center gap-5 rounded-hero bg-shelf p-6 text-center lg:flex-row lg:items-center lg:p-7 lg:text-left"
    >
      <Avatar initial={me.user.avatarInitial} tone="periwinkle" size={88} />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 lg:items-start">
        <p className="font-display text-[2rem] leading-tight [overflow-wrap:anywhere] lg:text-[2.75rem]">
          {me.user.displayName}
        </p>
        <p className="text-secondary [overflow-wrap:anywhere]">
          {[
            me.user.email,
            home ? t('profile.owner', { list: home.name }) : null,
            t('profile.joined', { date: joined }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<EditIcon size={18} />}
          onClick={() => setEditing(true)}
        >
          {t('profile.editProfile')}
        </Button>
      </div>
      <ul aria-label={t('profile.stats.label')} className="grid w-full grid-cols-3 gap-3 lg:w-auto">
        {tiles.map((s) => (
          <li
            key={s.key}
            data-testid={`stat-${s.key}`}
            className={cx(
              'flex flex-col items-center gap-1 rounded-card p-3 lg:w-40 lg:items-start lg:p-4',
              s.tone,
            )}
          >
            <span aria-hidden="true" className="hidden lg:inline">
              {s.icon}
            </span>
            <span className="font-display text-[2rem] leading-none">
              {status === 'loading' ? '–' : s.n}
            </span>
            <span className="text-xs font-semibold lg:text-sm">{s.label}</span>
          </li>
        ))}
      </ul>
      {editing ? <EditProfileSheet onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  const session = useSession();
  const toast = useToast();
  const online = useOnlineStatus();
  const [name, setName] = useState(me.user.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError(t('profile.edit.name'));
    setSaving(true);
    setError(null);
    try {
      await updateProfile(name.trim());
      await session.refresh();
      toast({ message: t('profile.edit.saved') });
      onClose();
    } catch {
      setError(t('profile.edit.failed'));
      setSaving(false);
    }
  }

  return (
    <BottomSheet open title={t('profile.edit.title')} onClose={onClose}>
      <form
        className="flex flex-col gap-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-name" className="font-semibold">
            {t('profile.edit.name')}
          </label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            aria-describedby="edit-name-hint"
            className="min-h-12 rounded-button bg-white px-4 bordered"
          />
          <p id="edit-name-hint" className="text-sm text-secondary">
            {t('profile.edit.hint')}
          </p>
        </div>
        {error ? <ErrorState message={error} /> : null}
        {!online ? (
          <p className="flex items-center gap-2 text-sm">
            <CloudOffIcon size={18} />
            {t('profile.privacy.offline')}
          </p>
        ) : null}
        <Button type="submit" loading={saving} disabled={!online}>
          {t('profile.edit.save')}
        </Button>
      </form>
    </BottomSheet>
  );
}

/** PRO-2: every list with its color, people and what's left to buy; New shared list. */
function ListsCard() {
  const { t } = useTranslation();
  const me = useMe();
  const people = usePeople(me);
  const ids = useMemo(() => me.lists.map((l) => l.id), [me.lists]);
  const items = useListsItems(ids);
  return (
    <Card id="lists-people" icon={<UserPlusIcon size={22} />} title={t('profile.lists.title')}>
      <p className="mt-1 text-sm text-secondary">{t('profile.lists.body')}</p>
      <ul className="-mx-5 mt-3 lg:-mx-6">
        {me.lists.map((l) => {
          const others = l.members.filter((m) => m.userId !== me.user.id);
          const toBuy = (items[l.id] ?? []).filter((i) => !i.checked).length;
          const who = l.isPrivate
            ? t('profile.lists.private')
            : others.length === 0
              ? t('profile.lists.you')
              : others.length <= 2
                ? t('profile.lists.youAnd', {
                    names: others.map((m) => m.displayName.split(' ')[0]).join(', '),
                  })
                : t('profile.lists.friends', { count: others.length });
          return (
            <li key={l.id} className="border-t-2 border-line">
              <Link
                to={`/lists/${l.id}/share`}
                aria-label={t('profile.lists.manage', { name: l.name })}
                className="flex min-h-16 items-center gap-3 px-5 py-2.5 lg:px-6"
              >
                <span
                  aria-hidden="true"
                  className={cx('size-3 shrink-0 rounded-full', listDotClass[l.color])}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold [overflow-wrap:anywhere]">{l.name}</span>
                  <span className="block text-sm text-secondary">
                    {who} · {t('profile.lists.toBuy', { count: toBuy })}
                  </span>
                </span>
                {l.isPrivate ? (
                  <LockIcon size={18} className="shrink-0 text-ink" />
                ) : (
                  <AvatarStack
                    people={l.members.map(
                      (m) =>
                        people.get(m.userId) ?? {
                          name: m.displayName,
                          initial: m.avatarInitial,
                          tone: 'peach' as const,
                        },
                    )}
                    size={26}
                  />
                )}
                <ChevronRightIcon size={20} className="shrink-0 text-navy" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Button asChild className="mt-2 self-start max-lg:w-full">
        <Link to="/lists/new">
          <PlusIcon size={20} />
          {t('profile.lists.new')}
        </Link>
      </Button>
    </Card>
  );
}

/** PRO-4: text size, high contrast, reduce motion, language. Saved to the account too. */
function DisplayCard() {
  const { t } = useTranslation();
  const s = useUiSettings();
  return (
    <Card id="display" icon={<CheckIcon size={22} />} title={t('profile.display.title')}>
      <div className="mt-2 flex flex-col divide-y-2 divide-line">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold">{t('profile.display.textSize')}</p>
            <p className="text-sm text-secondary">{t('profile.display.textSizeHint')}</p>
          </div>
          <SegmentedControl
            label={t('profile.display.textSize')}
            value={s.textSize}
            onChange={s.setTextSize}
            options={[
              { value: 'default', label: t('textSize.short.default') },
              { value: 'large', label: t('textSize.short.large') },
              { value: 'largest', label: t('textSize.short.largest') },
            ]}
          />
        </div>
        <Switch
          label={t('profile.display.contrast')}
          hint={t('profile.display.contrastHint')}
          checked={s.highContrast}
          onChange={s.setHighContrast}
        />
        <Switch
          label={t('profile.display.motion')}
          hint={t('profile.display.motionHint')}
          checked={s.reduceMotion}
          onChange={s.setReduceMotion}
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold">{t('profile.display.language')}</p>
            <p className="text-sm text-secondary">{t('profile.display.languageHint')}</p>
          </div>
          <p className="rounded-button px-4 py-2 font-semibold bordered">
            {t('profile.display.english')}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** A settings row action: named by its title, described by its hint (not read as one name). */
function RowButton({
  title,
  hint,
  icon,
  danger,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  title: string;
  hint?: string;
  icon: ReactNode;
  danger?: boolean;
}) {
  const id = useId();
  return (
    <button
      type="button"
      aria-labelledby={`${id}-t`}
      aria-describedby={hint ? `${id}-h` : undefined}
      className="flex min-h-16 w-full items-center justify-between gap-3 py-2.5 text-left disabled:opacity-60"
      {...rest}
    >
      <span>
        <span id={`${id}-t`} className={cx('block font-semibold', danger && 'text-terra-dark')}>
          {title}
        </span>
        {hint ? (
          <span id={`${id}-h`} className="block text-sm text-secondary">
            {hint}
          </span>
        ) : null}
      </span>
      {icon}
    </button>
  );
}

/** PRO-6: photo note, receipt history, download my data, sign out, delete account. */
function PrivacyCard() {
  const { t } = useTranslation();
  const me = useMe();
  const session = useSession();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { receipts } = useReceipts(me.pantry?.id ?? null);
  const [busy, setBusy] = useState<'download' | 'signout' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Lists that go with the account and that other people use (named before deleting).
  const sharedLost = me.lists
    .filter(
      (l) => (l.ownerId === me.user.id || l.pantryId === me.pantry?.id) && l.members.length > 1,
    )
    .map((l) => l.name);

  async function leave(action: () => Promise<void>, failure: string) {
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
      setBusy(null);
      return;
    }
    // Nothing about this account stays readable on the device.
    await wipeDeviceData();
    session.clear();
    navigate('/welcome', { replace: true });
  }

  const row =
    'flex min-h-16 w-full items-center justify-between gap-3 py-2.5 text-left disabled:opacity-60';
  return (
    <Card id="privacy" icon={<LockIcon size={22} />} title={t('profile.privacy.title')}>
      <div className="mt-2 flex flex-col divide-y-2 divide-line">
        <div className={row}>
          <div>
            <p className="font-semibold">{t('profile.privacy.photos')}</p>
            <p className="text-sm text-secondary">{t('profile.privacy.photosHint')}</p>
          </div>
          <CheckIcon size={22} className="shrink-0 text-olive" />
        </div>
        {/* PRO-6: Receipt history link. */}
        <Link to="/profile/receipts" className={row}>
          <span>
            <span className="block font-semibold">{t('profile.receiptHistory')}</span>
            <span className="block text-sm text-secondary">
              {t('profile.privacy.receipts', { count: receipts.length })}
            </span>
          </span>
          <ChevronRightIcon size={20} className="shrink-0 text-navy" />
        </Link>
        <RowButton
          title={t('profile.privacy.download')}
          hint={
            busy === 'download'
              ? t('profile.privacy.downloading')
              : online
                ? t('profile.privacy.downloadHint')
                : t('profile.privacy.offline')
          }
          icon={<DownloadIcon size={20} className="shrink-0 text-navy" />}
          disabled={!online || busy !== null}
          aria-busy={busy === 'download'}
          onClick={() => {
            setBusy('download');
            setError(null);
            void downloadMyData()
              .catch(() => setError(t('profile.privacy.downloadFailed')))
              .finally(() => setBusy(null));
          }}
        />
        <RowButton
          title={t('profile.signOut')}
          hint={online ? undefined : t('profile.signOutOffline')}
          icon={<ChevronRightIcon size={20} className="shrink-0 text-navy" />}
          disabled={!online || busy !== null}
          aria-busy={busy === 'signout'}
          onClick={() => {
            setBusy('signout');
            void leave(signOut, t('profile.signOutFailed'));
          }}
        />
        <RowButton
          title={t('profile.privacy.delete')}
          hint={t('profile.privacy.deleteHint')}
          danger
          icon={<TrashIcon size={20} className="shrink-0 text-terra-dark" />}
          disabled={!online || busy !== null}
          onClick={() => setConfirming(true)}
        />
      </div>
      {error ? (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title={t('profile.delete.title')}
        body={[
          t('profile.delete.body'),
          sharedLost.length ? t('profile.delete.shared', { lists: sharedLost.join(', ') }) : '',
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel={t('profile.delete.confirm')}
        cancelLabel={t('profile.delete.cancel')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setBusy('delete');
          void leave(deleteAccount, t('profile.delete.failed'));
        }}
      />
    </Card>
  );
}
