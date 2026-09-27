import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { CloudOffIcon } from '../icons';

export type OfflineBannerProps = {
  /** Force the banner (e.g. sync disconnected > 5 s, wired up with Yjs in Milestone 2). */
  forceShow?: boolean;
};

/** Small "Offline, changes will sync" banner (SRS 6 offline state). Icon + words, never color alone. */
export function OfflineBanner({ forceShow = false }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const { t } = useTranslation();
  const show = forceShow || !online;
  return (
    <div role="status" aria-live="polite">
      {show ? (
        <p className="flex items-center justify-center gap-2 bg-shelf px-4 py-2 text-sm font-medium text-ink">
          <CloudOffIcon size={18} />
          {t('offline.banner')}
        </p>
      ) : null}
    </div>
  );
}
