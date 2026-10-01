import {
  INVITE_TTL_DAYS,
  inviteChannel,
  type Invite,
  type InviteRole,
  type ListDetail,
} from '@shelf-life/shared';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../../lib/api';
import { formatShortDate } from '../../lib/format';
import type { Person } from '../../lib/people';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { Avatar } from '../Avatar/Avatar';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../Button/Button';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { ErrorState } from '../ErrorState/ErrorState';
import { CloseIcon, CopyIcon, LinkIcon, LockIcon, MailIcon, WarnIcon } from '../icons';
import { IconButton } from '../IconButton/IconButton';
import { Select } from '../Select/Select';
import { PageSkeleton } from '../Skeleton/Skeleton';
import { useToast } from '../Toast/Toast';

export type ShareDialogProps = {
  open: boolean;
  listId: string;
  userId: string;
  /** Avatar tint per person, shared with the rest of the app. */
  personOf: (userId: string, name: string) => Person;
  itemCount: number;
  onClose: () => void;
  /** Membership changed: refresh /me. */
  onChanged: () => void;
  /** The user left the list. */
  onLeft: () => void;
};

/** Where an invite for `to` opens: the user's own mail or messages app (no email service). */
export function inviteHref(to: string, url: string, listName: string, message: string) {
  const body = encodeURIComponent(`${message} ${url}`);
  return inviteChannel(to) === 'email'
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(listName)}&body=${body}`
    : `sms:${to.replace(/[^\d+]/g, '')}?&body=${body}`;
}

/**
 * Share a list (SRS 6.13 SHR-3, SHR-4; Figma web 19). People with roles, invite by email or phone
 * (opens the user's own mail or messages app with the link), a copyable link, Stop sharing.
 * Owners manage roles; editors can invite; viewers see who's on it.
 */
export function ShareDialog(props: ShareDialogProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const title = detail ? t('share.title', { name: detail.name }) : t('lists.share');
  return (
    <BottomSheet open={props.open} title={title} onClose={props.onClose}>
      {props.open ? <ShareBody {...props} detail={detail} setDetail={setDetail} /> : null}
    </BottomSheet>
  );
}

function ShareBody({
  listId,
  userId,
  personOf,
  itemCount,
  onClose,
  onChanged,
  onLeft,
  detail,
  setDetail,
}: ShareDialogProps & {
  detail: ListDetail | null;
  setDetail: (d: ListDetail | null) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnlineStatus();
  const ids = { invite: useId(), err: useId() };
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState<InviteRole>('edit');
  const [confirmStop, setConfirmStop] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api.fetchList(listId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [listId, setDetail]);
  useEffect(() => {
    let cancelled = false;
    api.fetchList(listId).then(
      (d) => !cancelled && setDetail(d),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [listId, setDetail]);

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await action();
      if (done) toast({ message: done });
      await load();
      onChanged();
    } catch (err) {
      toast({
        message: err instanceof api.ApiRequestError ? err.message : t('share.error'),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!online && !detail) return <ErrorState message={t('share.offline')} />;
  if (failed) return <ErrorState message={t('share.error')} onRetry={() => void load()} />;
  if (!detail) return <PageSkeleton />;

  const isOwner = detail.role === 'owner';
  const canInvite = detail.role !== 'view' && !detail.isPrivate;
  const link = detail.invites.find((i) => i.sentTo === null && i.role === linkRole) ?? null;
  const pending = detail.invites.filter((i) => i.sentTo !== null && i.acceptedAt === null);
  const roleLabel = (r: string) => t(`share.roles.${r}`);
  const message = t('share.privacy', { name: detail.name });

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const target = to.trim();
    await run(async () => {
      let invite: Invite;
      try {
        invite = await api.createInvite(listId, { role: 'edit', sendTo: target });
      } catch (err) {
        if (err instanceof api.ApiRequestError && err.status === 400) {
          setInviteError(err.message);
          return;
        }
        throw err;
      }
      setTo('');
      toast({
        message: t('share.inviteSent', {
          to: target,
          app: inviteChannel(target) === 'email' ? t('share.mail') : t('share.messages'),
        }),
      });
      window.location.assign(
        inviteHref(
          target,
          invite.url,
          detail!.name,
          t('share.inviteMessage', { name: detail!.name }),
        ),
      );
    });
  }

  async function copyLink() {
    let invite = link;
    if (!invite) {
      await run(async () => {
        invite = await api.createInvite(listId, { role: linkRole });
      });
    }
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast({ message: t('share.copied') });
    } catch {
      // No clipboard access (some browsers, private windows): the link is shown to copy by hand.
      toast({ message: t('share.copyFailed') });
    }
  }

  const meta = [
    t('share.meta', { count: itemCount }),
    detail.shopBy ? t('share.shopBy', { date: formatShortDate(detail.shopBy, detail.shopBy) }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="text-sm text-secondary">{meta}</p>

      {detail.isPrivate ? (
        <div className="flex flex-col items-start gap-3 rounded-card bg-shelf p-4">
          <p className="flex items-center gap-2 text-ink">
            <LockIcon size={18} />
            {t('share.privateList')}
          </p>
          {isOwner ? (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void run(() => api.updateList(listId, { isPrivate: false }))}
            >
              {t('share.makeShareable')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canInvite ? (
        <form noValidate onSubmit={sendInvite} className="flex flex-col gap-1.5">
          <label htmlFor={ids.invite} className="sr-only">
            {t('share.inviteLabel')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MailIcon
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
              />
              <input
                id={ids.invite}
                value={to}
                inputMode="email"
                autoComplete="off"
                placeholder={t('share.inviteLabel')}
                aria-invalid={inviteError ? true : undefined}
                aria-describedby={inviteError ? ids.err : undefined}
                onChange={(e) => setTo(e.target.value)}
                className="min-h-12 w-full rounded-button bg-white pl-11 pr-3 text-base text-ink bordered aria-invalid:border-terra-dark"
              />
            </div>
            <Button type="submit" loading={busy} disabled={!online || to.trim() === ''}>
              {t('share.invite')}
            </Button>
          </div>
          {inviteError ? (
            <p id={ids.err} className="flex items-center gap-2 text-sm font-medium text-terra-dark">
              <WarnIcon size={16} />
              {inviteError}
            </p>
          ) : null}
        </form>
      ) : null}

      <section
        aria-label={t('share.people')}
        className="rounded-card border-2 border-line bg-white"
      >
        <ul className="divide-y-2 divide-line">
          {detail.members.map((m) => {
            const person = personOf(m.userId, m.displayName);
            const you = m.userId === userId;
            return (
              <li
                key={m.userId}
                className="flex items-center gap-3 px-4 py-3"
                data-testid="share-member"
              >
                <Avatar initial={person.initial} tone={person.tone} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{you ? t('share.you') : m.displayName}</p>
                  <p className="text-sm text-secondary">
                    {m.role === 'owner'
                      ? t('share.owner')
                      : t('share.joined', { date: formatShortDate(m.joinedAt, m.joinedAt) })}
                  </p>
                </div>
                {m.role === 'owner' ? (
                  <span className="rounded-button border-2 border-line px-3 py-2 text-sm font-semibold text-ink">
                    {roleLabel('owner')}
                  </span>
                ) : isOwner ? (
                  <>
                    <Select
                      className="w-36 [&>span:first-child]:sr-only"
                      label={t('share.roleFor', { name: m.displayName })}
                      value={m.role}
                      onChange={(role) =>
                        void run(() => api.changeRole(listId, m.userId, role as InviteRole))
                      }
                      options={(['edit', 'view'] as const).map((r) => ({
                        value: r,
                        label: roleLabel(r),
                      }))}
                    />
                    <IconButton
                      variant="ghost"
                      icon={<CloseIcon size={18} />}
                      label={t('share.remove', { name: m.displayName })}
                      onClick={() => void run(() => api.removeMember(listId, m.userId))}
                    />
                  </>
                ) : (
                  <span className="text-sm font-semibold text-ink">{roleLabel(m.role)}</span>
                )}
              </li>
            );
          })}
          {pending.map((i) => (
            <li
              key={i.token}
              className="flex items-center gap-3 px-4 py-3"
              data-testid="share-pending"
            >
              <Avatar
                initial={(i.sentTo ?? '?').charAt(0).toUpperCase()}
                tone="periwinkle"
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink [overflow-wrap:anywhere]">{i.sentTo}</p>
                <p className="text-sm text-secondary">{t('share.pending')}</p>
              </div>
              <span className="text-sm font-semibold text-ink">{roleLabel(i.role)}</span>
              <IconButton
                variant="ghost"
                icon={<CloseIcon size={18} />}
                label={t('share.revoke', { to: i.sentTo })}
                onClick={() => void run(() => api.revokeInvite(listId, i.token))}
              />
            </li>
          ))}
        </ul>
      </section>

      {canInvite ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-shelf p-4">
          <LinkIcon size={20} className="shrink-0 text-navy" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">
              {t('share.linkTitle', { role: roleLabel(linkRole) })}
            </p>
            <p className="text-sm text-secondary [overflow-wrap:anywhere]">
              {link ? `${link.url.replace(/^https?:\/\//, '')} · ` : ''}
              {t('share.linkMeta', { days: INVITE_TTL_DAYS })}
            </p>
          </div>
          <Select
            className="w-36 [&>span:first-child]:sr-only"
            label={t('share.linkRole')}
            value={linkRole}
            onChange={(r) => setLinkRole(r as InviteRole)}
            options={(['edit', 'view'] as const).map((r) => ({ value: r, label: roleLabel(r) }))}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<CopyIcon size={18} />}
            loading={busy}
            disabled={!online}
            aria-label={t('share.copyLink')}
            onClick={() => void copyLink()}
          >
            {t('share.copy')}
          </Button>
        </div>
      ) : null}

      <p className="flex items-start gap-2 text-sm text-ink">
        <LockIcon size={16} className="mt-0.5 shrink-0" />
        <span>
          {message} {detail.isHome ? t('share.privacyHome') : ''}
        </span>
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {isOwner && (detail.members.length > 1 || detail.invites.length > 0) ? (
          <Button variant="danger" onClick={() => setConfirmStop(true)}>
            {t('share.stop')}
          </Button>
        ) : null}
        {!isOwner ? (
          <Button
            variant="secondary"
            onClick={() =>
              void run(async () => {
                await api.removeMember(listId, userId);
                onLeft();
              })
            }
          >
            {t('share.leave')}
          </Button>
        ) : null}
        <Button onClick={onClose}>{t('share.done')}</Button>
      </div>

      <ConfirmDialog
        open={confirmStop}
        title={t('share.stopTitle', { name: detail.name })}
        body={t('share.stopBody')}
        confirmLabel={t('share.stopConfirm')}
        cancelLabel={t('share.keep')}
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          void run(() => api.stopSharing(listId), t('share.stopped'));
        }}
      />
    </div>
  );
}
