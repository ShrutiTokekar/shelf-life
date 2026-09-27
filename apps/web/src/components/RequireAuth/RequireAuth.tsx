import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { ErrorState } from '../ErrorState/ErrorState';
import { PageSkeleton } from '../Skeleton/Skeleton';

export type RequireAuthProps = {
  children: ReactNode;
  /** Home list setup itself must not bounce back to itself. */
  allowWithoutPantry?: boolean;
};

/**
 * Guards signed-in routes. Signed out → /welcome. Signed in without a pantry → home list setup
 * (WEL-2: new users go to setup, returning users to Today).
 */
export function RequireAuth({ children, allowWithoutPantry = false }: RequireAuthProps) {
  const session = useSession();
  const location = useLocation();
  const { t } = useTranslation();

  switch (session.status) {
    case 'loading':
      return <PageSkeleton />;
    case 'signedOut':
      return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
    case 'error':
      return (
        <main id="main" className="page-x py-10">
          <ErrorState message={t('common.genericError')} onRetry={() => void session.refresh()} />
        </main>
      );
    case 'ready':
      if (!session.me.pantry && !allowWithoutPantry) return <Navigate to="/onboarding" replace />;
      if (session.me.pantry && allowWithoutPantry) return <Navigate to="/" replace />;
      return <>{children}</>;
  }
}
