import {
  daysLeft,
  formatQuantity,
  formatTimeLeft,
  lineCaption,
  needsLook,
  type ReviewItem,
} from '@shelf-life/shared';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { CheckIcon, EditIcon, WarnIcon } from '../icons';
import { IconButton } from '../IconButton/IconButton';

export type ReviewItemCardProps = {
  item: ReviewItem;
  today: string;
  onToggle: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  /** Newly restored card: move focus to it so the user can check it (REV-5). */
  autoFocusEdit?: boolean;
};

/**
 * One grocery line on the review screen (SRS 7 ReviewItemCard, REV-3, REV-4): raw receipt text,
 * checkbox, matched name, "qty · location · ~expiry", edit button. Unsure matches (confidence
 * < 0.8) are tinted with a trailing "?" and a note until confirmed. Without AI (Milestone 6) the
 * note is the plain "we're not sure" fallback, never an AI claim.
 */
export function ReviewItemCard({
  item,
  today,
  onToggle,
  onConfirm,
  onEdit,
  autoFocusEdit,
}: ReviewItemCardProps) {
  const { t } = useTranslation();
  const metaId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocusEdit) editRef.current?.focus();
  }, [autoFocusEdit]);
  const unsure = needsLook(item);
  const quantity = formatQuantity({ quantity: item.quantity, unit: item.unit });
  const meta = [
    quantity,
    t(`locations.${item.location}`),
    `~${formatTimeLeft(daysLeft(item, today))}`,
  ].filter(Boolean);

  return (
    <li
      data-testid="review-item"
      data-unsure={unsure || undefined}
      className={cx(
        'flex flex-col gap-2 rounded-card border-2 p-4',
        unsure ? 'border-apricot-border bg-peach/45' : 'border-line bg-white',
        !item.included && 'opacity-70',
      )}
    >
      <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-secondary [overflow-wrap:anywhere]">
        {lineCaption(item.raw)}
      </p>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.included}
          onChange={onToggle}
          aria-label={t('review.include', { name: item.name })}
          aria-describedby={metaId}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--navy)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight text-ink [overflow-wrap:anywhere]">
            {item.name}
            {unsure ? (
              <>
                <span aria-hidden="true">?</span>
                <span className="sr-only">, {t('review.unsureSpoken')}</span>
              </>
            ) : null}
          </p>
          <p id={metaId} className="mt-0.5 text-sm text-secondary">
            {meta.join(' · ')}
          </p>
        </div>
        <IconButton
          icon={<EditIcon size={20} />}
          label={t('review.editItem', { name: item.name })}
          onClick={onEdit}
          variant="ghost"
          className="-mr-2 -mt-2 shrink-0"
          ref={editRef}
        />
      </div>
      {unsure ? (
        <button
          type="button"
          onClick={onConfirm}
          className="-mx-1 flex min-h-11 items-center gap-2 rounded-xl px-1 text-left text-sm font-medium text-apricot-dark"
        >
          <WarnIcon size={16} className="shrink-0" />
          <span>{t('review.unsureNote', { raw: lineCaption(item.raw) })}</span>
          <CheckIcon size={16} className="ml-auto shrink-0" />
        </button>
      ) : null}
    </li>
  );
}
