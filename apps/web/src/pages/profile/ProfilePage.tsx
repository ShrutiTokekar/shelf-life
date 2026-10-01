import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ChevronRightIcon, CloudOffIcon, LockIcon, ReceiptIcon } from '../../components/icons';
import { signOut } from '../../lib/api';
import { closeAllDocs } from '../../lib/sync/docs';
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
    closeAllDocs();
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
        {/* PRO-6: Receipt history link. */}
        <Link
          to="/profile/receipts"
          className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 text-ink"
        >
          <ReceiptIcon size={22} className="text-navy" />
          <span className="flex-1">
            <span className="block font-semibold">{t('profile.receiptHistory')}</span>
            <span className="block text-sm text-secondary">{t('profile.receiptHistoryBody')}</span>
          </span>
          <ChevronRightIcon size={20} className="text-navy" />
        </Link>
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
