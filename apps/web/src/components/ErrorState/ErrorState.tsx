import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { RefreshIcon, WarnIcon } from '../icons';

export type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

/** Plain-language message plus retry (SRS 6: error state). Announced via role="alert". */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-card bg-terra-light px-6 py-8 text-center text-terra-dark"
    >
      <p className="flex items-center gap-2 text-[1.0625rem] font-medium">
        <WarnIcon size={22} />
        {message}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={<RefreshIcon size={20} />} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
