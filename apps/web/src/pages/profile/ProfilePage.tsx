import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { CloudOffIcon, LockIcon } from '../../components/icons';
import { signOut } from '../../lib/api';
import { useMe, useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

/**
 * Profile (SRS 6.11). Milestone 1 ships the hero (PRO-1, without stats) and Sign out (PRO-6);
 * the rest of the page arrives in Milestone 8.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const me = useMe();
  const session = useSession();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onSignOut() {
    setFailed(false);
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setFailed(true);
      setSigningOut(false);
      return;
    }
    // Drop the cached /me so nothing about this account stays readable on the device.
    session.clear();
    navigate('/welcome', { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 page-x py-8">
      <h1 className="text-[2rem] leading-[1.125] lg:text-[3.5rem] lg:leading-[1.14]">
        {t('profile.title')}
      </h1>

      <section
        className="flex items-center gap-4 rounded-hero bg-white p-6 bordered"
        aria-label={me.user.displayName}
      >
        <Avatar initial={me.user.avatarInitial} tone="periwinkle" size={64} />
        <div className="min-w-0">
          <p className="font-display text-2xl text-ink [overflow-wrap:anywhere]">
            {me.user.displayName}
          </p>
          <p className="text-secondary [overflow-wrap:anywhere]">{me.user.email}</p>
        </div>
      </section>

      <p className="text-secondary">{t('profile.comingSoon')}</p>

      <section
        aria-labelledby="account-heading"
        className="flex flex-col gap-4 rounded-card bg-white p-6 bordered"
      >
        <h2 id="account-heading" className="text-2xl">
          {t('profile.account')}
        </h2>
        <p className="flex items-center gap-2 text-secondary">
          <LockIcon size={18} />
          {t('profile.photoNote')}
        </p>
        {failed ? <ErrorState message={t('profile.signOutFailed')} /> : null}
        {!online ? (
          <p className="flex items-center gap-2 text-sm text-ink">
            <CloudOffIcon size={18} />
            {t('profile.signOutOffline')}
          </p>
        ) : null}
        <Button
          variant="secondary"
          loading={signingOut}
          disabled={!online}
          onClick={() => void onSignOut()}
        >
          {t('profile.signOut')}
        </Button>
      </section>
    </div>
  );
}
