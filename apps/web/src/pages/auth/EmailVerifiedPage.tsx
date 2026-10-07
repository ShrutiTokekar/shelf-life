import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { useSession } from '../../lib/session';
import { markActive } from '../../lib/sessionTimeout';
import { AuthLayout, ButtonLink } from './AuthLayout';

/**
 * Where the confirmation link lands (Milestone 9b). Confirming signs the person in; new accounts
 * then go through home list setup like Google sign-ups.
 */
export function EmailVerifiedPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const session = useSession();
  const failed = params.get('error') !== null;
  const { refresh } = session;
  // The confirmation set a session cookie: load the account again, once.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (failed) return;
    markActive();
    void refresh().then(() => setChecked(true));
  }, [failed, refresh]);

  if (failed)
    return (
      <AuthLayout title={t('auth.verified.expiredTitle')} intro={t('auth.verified.expired')}>
        <ButtonLink to="/sign-in" variant="primary">
          {t('auth.signIn.submit')}
        </ButtonLink>
      </AuthLayout>
    );
  if (session.status === 'ready') return <Navigate to="/" replace />;
  if (session.status === 'loading' || !checked) return <PageSkeleton />;
  return (
    <AuthLayout title={t('auth.verified.expiredTitle')} intro={t('auth.verified.expired')}>
      <ButtonLink to="/sign-in" variant="primary">
        {t('auth.signIn.submit')}
      </ButtonLink>
    </AuthLayout>
  );
}
