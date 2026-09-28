import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { BellIcon, ScanIcon } from '../../components/icons';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { useMe } from '../../lib/session';

/**
 * Today (SRS 6.2). Milestone 1 ships the empty state that prompts the first scan (flow 1).
 * Priorities and the shelf-life timeline arrive with ranking in Milestone 6.
 */
export function TodayPage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 page-x py-8">
      {/* Mobile top bar (Figma 02). Desktop has these in the header. The "Aa" text size button
          waits for the display settings work in Milestone 8. */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <Wordmark size={28} />
        <div className="flex items-center gap-2">
          <Link
            to="/reminders"
            aria-label={t('nav.reminders')}
            className="flex size-11 items-center justify-center rounded-xl bg-white text-ink bordered"
          >
            <BellIcon size={22} />
          </Link>
          <Link
            to="/profile"
            aria-label={t('nav.account', { name: me.user.displayName })}
            className="rounded-chip"
          >
            <Avatar initial={me.user.avatarInitial} tone="periwinkle" size={44} />
          </Link>
        </div>
      </div>
      <h1 className="text-[2rem] leading-[1.125] lg:text-[3.5rem] lg:leading-[1.14]">
        {t('today.title')}
      </h1>
      <div id="priorities" tabIndex={-1} className="outline-none">
        <EmptyState
          title={t('today.emptyTitle')}
          body={t('today.emptyBody')}
          action={
            <Button asChild>
              <Link to="/scan">
                <ScanIcon size={22} />
                {t('today.emptyAction')}
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
