import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ScanIcon } from '../../components/icons';

/**
 * Today (SRS 6.2). Milestone 1 ships the empty state that prompts the first scan (flow 1).
 * Priorities and the shelf-life timeline arrive with ranking in Milestone 6.
 */
export function TodayPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 page-x py-8">
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
