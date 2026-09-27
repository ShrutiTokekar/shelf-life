import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { pendingInvite } from '../../lib/pendingInvite';
import { useSession } from '../../lib/session';

/**
 * /join/:token (WEL-3). Stores the token so it survives Google sign-in. Accepting the invite
 * (POST /invites/:token/accept) is built with list sharing in Milestone 5.
 */
export function JoinPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const session = useSession();

  useEffect(() => {
    if (token) pendingInvite.save(token);
  }, [token]);

  if (!token) return <Navigate to="/welcome" replace />;
  if (session.status === 'loading') return <PageSkeleton />;
  if (session.status !== 'ready') return <Navigate to="/welcome" replace />;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[30rem] flex-col items-center gap-6 px-6 pt-16 text-center"
    >
      <Wordmark size={32} />
      <h1 className="text-[2rem] leading-tight">{t('join.title')}</h1>
      <p className="text-[1.0625rem] text-secondary">{t('join.signedInBody')}</p>
      <Button asChild>
        <Link to="/">{t('placeholder.action')}</Link>
      </Button>
    </main>
  );
}
