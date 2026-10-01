import type { InvitePreview } from '@shelf-life/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { LockIcon } from '../../components/icons';
import { listDotClass } from '../../components/PantryLabel/PantryLabel';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { acceptInvite, ApiRequestError, NetworkError, previewInvite } from '../../lib/api';
import { pendingInvite } from '../../lib/pendingInvite';
import { useSession } from '../../lib/session';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: InvitePreview }
  | { kind: 'invalid' }
  | { kind: 'offline' };

/**
 * /join/:token (WEL-3, SHR-3). Signed out: keep the token and sign in first. Signed in: show who
 * invited you to what, then join with the link's role.
 */
export function JoinPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (token) pendingInvite.save(token);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setState({ kind: 'ready', preview: await previewInvite(token) });
    } catch (err) {
      if (err instanceof NetworkError) setState({ kind: 'offline' });
      else {
        // Expired, revoked or made up: nothing to keep.
        pendingInvite.clear();
        setState({ kind: 'invalid' });
      }
    }
  }, [token]);

  const ready = session.status === 'ready';
  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    previewInvite(token).then(
      (preview) => !cancelled && setState({ kind: 'ready', preview }),
      (err: unknown) => {
        if (cancelled) return;
        if (err instanceof NetworkError) return setState({ kind: 'offline' });
        // Expired, revoked or made up: nothing to keep.
        pendingInvite.clear();
        setState({ kind: 'invalid' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  if (!token) return <Navigate to="/welcome" replace />;
  if (session.status === 'loading') return <PageSkeleton />;
  if (session.status !== 'ready') return <Navigate to="/welcome" replace />;

  async function join() {
    setJoining(true);
    try {
      const { listId } = await acceptInvite(token!);
      pendingInvite.clear();
      await session.refresh();
      navigate(`/lists/${listId}`, { replace: true });
    } catch (err) {
      setJoining(false);
      if (err instanceof ApiRequestError) {
        pendingInvite.clear();
        setState({ kind: 'invalid' });
      } else setState({ kind: 'offline' });
    }
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[30rem] flex-col items-center gap-6 px-6 pt-16 text-center"
    >
      <Wordmark size={32} />
      <h1 className="text-[2rem] leading-tight">{t('join.title')}</h1>
      {state.kind === 'loading' ? <PageSkeleton /> : null}
      {state.kind === 'offline' ? (
        <ErrorState
          message={t('join.offline')}
          onRetry={() => {
            setState({ kind: 'loading' });
            void load();
          }}
        />
      ) : null}
      {state.kind === 'invalid' ? (
        <>
          <p className="text-[1.0625rem] text-ink">{t('join.failed')}</p>
          <Button asChild variant="secondary">
            <Link to="/">{t('placeholder.action')}</Link>
          </Button>
        </>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <p className="flex items-center gap-2 text-[1.0625rem] text-ink">
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 rounded-chip ${listDotClass[state.preview.color]}`}
            />
            {t('join.preview', {
              inviter: state.preview.invitedBy,
              list: state.preview.listName,
              role: t(`share.roles.${state.preview.role}`),
            })}
          </p>
          {state.preview.sharesPantry ? (
            <p className="flex items-center gap-2 text-sm text-secondary">
              <LockIcon size={16} />
              {t('join.sharesPantry')}
            </p>
          ) : null}
          {state.preview.alreadyMember ? (
            <>
              <p className="text-secondary">{t('join.already')}</p>
              <Button onClick={() => void join()} loading={joining}>
                {t('join.open')}
              </Button>
            </>
          ) : (
            <Button onClick={() => void join()} loading={joining}>
              {t('join.accept')}
            </Button>
          )}
        </>
      ) : null}
    </main>
  );
}
