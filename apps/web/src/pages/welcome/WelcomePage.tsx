import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { CloudOffIcon, LockIcon } from '../../components/icons';
import { OfflineBanner } from '../../components/OfflineBanner/OfflineBanner';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { LogoStacked } from '../../components/Wordmark/Wordmark';
import { startGoogleSignIn } from '../../lib/api';
import { pendingInvite } from '../../lib/pendingInvite';
import { markActive } from '../../lib/sessionTimeout';
import { forgetExpired, useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

/** Welcome and sign in (SRS 6.1, Figma mobile 01). */
export function WelcomePage() {
  const { t } = useTranslation();
  const session = useSession();
  const online = useOnlineStatus();
  const [params] = useSearchParams();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(params.get('error') !== null);
  const hasInvite = pendingInvite.get() !== null;

  if (session.status === 'ready') return <Navigate to="/" replace />;

  async function signIn() {
    setFailed(false);
    setStarting(true);
    // SEC-9: a fresh sign-in starts the 5-hour idle clock again.
    markActive();
    forgetExpired();
    try {
      await startGoogleSignIn();
    } catch {
      setFailed(true);
      setStarting(false);
    }
  }

  return (
    <>
      <SkipLink targetId="sign-in" text={t('skip.signIn')} />
      <OfflineBanner />
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col items-center px-6 pb-11 pt-[clamp(2rem,10vh,5.625rem)] text-center"
      >
        <h1 className="w-full">
          <LogoStacked className="mx-auto" />
        </h1>
        <p className="mt-7 font-ui text-2xl font-semibold text-navy">{t('app.slogan')}</p>
        <p className="mt-3 text-[1.0625rem] leading-[1.47] text-secondary">
          {t('welcome.description')}
        </p>

        <div className="min-h-10 flex-1" />

        <div
          id="sign-in"
          tabIndex={-1}
          className="flex w-full flex-col items-center gap-3 outline-none"
        >
          {session.status === 'signedOut' && session.reason === 'expired' && !failed ? (
            <p role="status" className="flex items-center gap-2 text-sm text-ink">
              <LockIcon size={18} />
              {t('welcome.expired')}
            </p>
          ) : null}
          {failed ? <ErrorState message={t('welcome.signInFailed')} /> : null}
          {!online ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <CloudOffIcon size={18} />
              {t('welcome.offline')}
            </p>
          ) : null}
          <Button fullWidth loading={starting} disabled={!online} onClick={() => void signIn()}>
            {t('welcome.continueWithGoogle')}
          </Button>
          <p className="text-sm text-secondary">
            {hasInvite ? t('welcome.invitePending') : t('welcome.inviteHelper')}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[0.8125rem] text-secondary">
            <LockIcon size={16} />
            {t('welcome.privacy')}
          </p>
        </div>
      </main>
    </>
  );
}
