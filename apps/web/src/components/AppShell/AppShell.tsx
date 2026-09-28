import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatches } from 'react-router-dom';
import { useMe } from '../../lib/session';
import { useUiSettings } from '../../stores/uiSettings';
import { navKeyForPath } from '../nav';
import { NavBottom } from '../NavBottom/NavBottom';
import { NavHeader } from '../NavHeader/NavHeader';
import { OfflineBanner } from '../OfflineBanner/OfflineBanner';
import { SkipLink } from '../SkipLink/SkipLink';

/** Route `handle` a page can set to customize its skip link (SRS 5.1). */
export type RouteHandle = { skipLink?: { targetId: string; textKey: string } };

/**
 * Signed-in layout: skip link first, then desktop header (≥ 1024 px) or mobile bottom nav,
 * offline banner, and the page inside <main id="main">.
 */
export function AppShell() {
  const { t } = useTranslation();
  const me = useMe();
  const { pathname } = useLocation();
  const matches = useMatches();
  const settings = useUiSettings();

  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.skipLink)
    ?.handle as RouteHandle | undefined;
  const skip = handle?.skipLink ?? { targetId: 'main', textKey: 'skip.main' };

  const active = navKeyForPath(pathname);
  const listHref = me.pantry ? `/lists/${me.pantry.homeListId}` : '/lists';

  return (
    <div className="min-h-dvh pb-32 lg:pb-12">
      <SkipLink targetId={skip.targetId} text={t(skip.textKey)} />
      <NavHeader
        className="max-lg:hidden"
        active={active}
        listHref={listHref}
        userName={me.user.displayName}
        userInitial={me.user.avatarInitial}
        textSize={settings.textSize}
        onTextSizeChange={settings.setTextSize}
        highContrast={settings.highContrast}
        onHighContrastChange={settings.setHighContrast}
      />
      <OfflineBanner />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <NavBottom className="lg:hidden" active={active} listHref={listHref} />
    </div>
  );
}
