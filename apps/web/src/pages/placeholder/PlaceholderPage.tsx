import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';

/** Stand-in for routes built in later milestones (SRS 15.1). Keeps h1 + landmarks correct. */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 page-x py-8">
      <h1 className="text-[2rem] leading-[1.125] lg:text-[3.5rem] lg:leading-[1.14]">
        {t(titleKey)}
      </h1>
      <EmptyState
        title={t(titleKey)}
        body={t('placeholder.body')}
        action={
          <Button asChild variant="secondary">
            <Link to="/">{t('placeholder.action')}</Link>
          </Button>
        }
      />
    </div>
  );
}
