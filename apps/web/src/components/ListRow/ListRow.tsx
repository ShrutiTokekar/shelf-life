import type { ListItem } from '@shelf-life/shared';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import type { Person } from '../../lib/people';
import { Button } from '../Button/Button';
import { ClaimPill } from '../ClaimPill/ClaimPill';
import { EditIcon, HandIcon } from '../icons';
import { IconButton } from '../IconButton/IconButton';

export type ListRowProps = {
  item: ListItem;
  claimer: (Person & { isYou: boolean }) | null;
  /** Why it's on the list, e.g. "Ran out this morning · added by Maya" (LST-4). */
  reason: { icon: ReactNode; text: string };
  /** SHR-5: "Can view" members see rows but can't check, claim or edit. */
  canEdit: boolean;
  onCheck: () => void;
  onClaim: () => void;
  onEdit: () => void;
  /** Web layout: claim status on the right, short "Nobody yet" (Figma 14). */
  wide?: boolean;
  /** LST-9 shopping mode: 20 px+ text, 44 px checkbox, no claim or edit controls. */
  large?: boolean;
};

/** "1 dozen", "× 2", "20 lb", or nothing. */
export function quantityText(item: Pick<ListItem, 'quantity' | 'unit'>): string {
  if (item.quantity === null) return item.unit;
  const n = String(item.quantity);
  return item.unit ? `${n} ${item.unit}` : `× ${n}`;
}

/**
 * A grocery list row (SRS 7 ListRow, LST-4, LST-5): checkbox labeled by the item name, quantity,
 * reason, and claim status with "I'll get it". Checking moves it to the cart (LST-7).
 */
export function ListRow({
  item,
  claimer,
  reason,
  canEdit,
  onCheck,
  onClaim,
  onEdit,
  wide = false,
  large = false,
}: ListRowProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const reasonId = useId();
  const qty = quantityText(item);

  return (
    <li
      data-testid="list-row"
      data-checked={item.checked || undefined}
      className={cx('flex items-start gap-3 px-5', large ? 'py-5' : 'py-3.5')}
    >
      <span
        className={cx(
          'flex shrink-0 items-center justify-center',
          large ? 'size-11' : 'size-11 -m-2',
        )}
      >
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onCheck}
          disabled={!canEdit}
          aria-labelledby={nameId}
          aria-describedby={reasonId}
          className={cx(
            'cursor-pointer rounded-lg accent-[var(--navy)] disabled:cursor-not-allowed',
            large ? 'size-11' : 'size-7',
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('flex flex-wrap items-baseline gap-x-2', large && 'text-xl')}>
          <span
            id={nameId}
            className={cx(
              'font-semibold text-ink [overflow-wrap:anywhere]',
              large ? 'text-[1.375rem]' : 'text-lg',
              item.checked && 'line-through',
            )}
          >
            {item.name}
          </span>
          {qty ? (
            <span className={cx('text-secondary', large ? 'text-lg' : 'text-sm')}>{qty}</span>
          ) : null}
        </p>
        <p
          id={reasonId}
          className={cx(
            'mt-0.5 flex items-center gap-1.5 text-secondary',
            large ? 'text-base' : 'text-sm',
          )}
        >
          <span className="shrink-0">{reason.icon}</span>
          <span className="[overflow-wrap:anywhere]">{reason.text}</span>
        </p>
        {!large && !item.checked && !wide ? <ClaimPill claimer={claimer} className="mt-1" /> : null}
      </div>
      {!large && !item.checked ? (
        <div className="flex shrink-0 items-center gap-2 self-center">
          {wide ? <ClaimPill claimer={claimer} short /> : null}
          {canEdit && !claimer ? (
            wide ? (
              <Button
                size="sm"
                icon={<HandIcon size={18} />}
                onClick={onClaim}
                aria-label={t('lists.claim.illGetItLabel', { name: item.name })}
              >
                {t('lists.claim.illGetIt')}
              </Button>
            ) : (
              <IconButton
                variant="primary"
                icon={<HandIcon size={22} />}
                label={t('lists.claim.illGetItLabel', { name: item.name })}
                onClick={onClaim}
                className="size-12 rounded-[0.875rem]"
              />
            )
          ) : null}
          {canEdit ? (
            <IconButton
              variant="ghost"
              icon={<EditIcon size={18} />}
              label={t('lists.edit', { name: item.name })}
              onClick={onEdit}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
