import {
  formatQuantity,
  formatRanOut,
  formatTimeLeft,
  daysLeft,
  type ListColor,
  type PantryItem,
  type Shelf,
} from '@shelf-life/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { Avatar, type AvatarTone } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { BoxIcon, CartIcon, CheckIcon, EditIcon, FridgeIcon, PlusIcon, SnowIcon } from '../icons';
import { PantryLabel } from '../PantryLabel/PantryLabel';
import { StatusTag } from '../StatusTag/StatusTag';

const lid: Record<Shelf, string> = {
  today: 'bg-terra',
  soon: 'bg-apricot-lid',
  fresh: 'bg-olive',
  out: 'bg-out-lid',
};

const body: Record<Shelf, string> = {
  today: 'border-terra',
  soon: 'border-apricot-border',
  fresh: 'border-sage-border',
  out: 'border-line',
};

const locationIcon = {
  fridge: <FridgeIcon size={14} />,
  freezer: <SnowIcon size={14} />,
  cupboard: <BoxIcon size={14} />,
};

export type JarPerson = { name: string; initial: string; tone: AvatarTone };

export type JarCardProps = {
  item: PantryItem;
  status: Shelf;
  today: string;
  list: { name: string; color: ListColor };
  addedBy: JarPerson | null;
  /** For ran-out jars already on a list: who claimed it, or null if nobody yet (PAN-9). */
  onList?: { claimedBy: string | null } | null;
  onUsed: () => void;
  onEdit: () => void;
  onAddToList: () => void;
  /** Just added from a receipt: outlined and tagged "New" for a moment (REV-7). */
  highlighted?: boolean;
};

/**
 * A pantry item as a jar (SRS 4.6, 7): lid colored by status, pantry label, status tag and actions.
 * The card itself isn't a button; its actions are (SRS 7).
 */
export function JarCard({
  item,
  status,
  today,
  list,
  addedBy,
  onList,
  onUsed,
  onEdit,
  onAddToList,
  highlighted = false,
}: JarCardProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const out = status === 'out';
  const qty = out ? t('pantry.jar.left', { count: 0 }) : formatQuantity(item);
  const where = t(`locations.${item.location}`);
  const statusText = out ? formatRanOut(item.outAt, today) : formatTimeLeft(daysLeft(item, today));

  return (
    <li className="flex shrink-0 snap-start flex-col items-center" data-testid="jar">
      <span aria-hidden="true" className={cx('h-2.5 w-20 rounded-t-[0.3125rem]', lid[status])} />
      <article
        aria-labelledby={nameId}
        data-highlighted={highlighted || undefined}
        className={cx(
          'flex w-[10.75rem] flex-col gap-2 rounded-[1.125rem] border-2 bg-white p-3 lg:w-[14.125rem]',
          'outline-offset-2 transition-[outline-color] duration-500 motion-reduce:transition-none',
          highlighted ? 'outline-4 outline-navy' : 'outline-transparent',
          body[status],
        )}
      >
        {highlighted ? (
          <span className="-mb-1 self-start rounded-chip bg-navy px-2 py-0.5 text-xs font-semibold text-white">
            {t('pantry.jar.new')}
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <h3
            id={nameId}
            className="font-ui text-base font-semibold leading-tight text-ink [overflow-wrap:anywhere]"
          >
            {item.name}
          </h3>
          {addedBy ? (
            <Avatar
              initial={addedBy.initial}
              tone={addedBy.tone}
              size={22}
              label={t('pantry.jar.addedBy', { name: addedBy.name })}
            />
          ) : null}
        </div>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-secondary">
          <span className="hidden lg:inline-flex">{locationIcon[item.location]}</span>
          {qty ? `${qty} · ${where}` : where}
        </p>
        <PantryLabel listName={list.name} color={list.color} />
        <StatusTag
          status={status}
          text={statusText}
          // SRS 8.3: dates estimated from category defaults (or AI) are marked as estimates.
          suffix={
            !out && item.expiryIsEstimate
              ? { visible: t('pantry.jar.estShort'), spoken: t('pantry.jar.estSpoken') }
              : undefined
          }
          className="w-full"
        />

        {out ? (
          onList ? (
            <p className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-semibold text-olive-dark">
              <CartIcon size={16} />
              {onList.claimedBy
                ? t('pantry.jar.onListBy', { name: onList.claimedBy })
                : t('pantry.jar.onList')}
            </p>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 whitespace-nowrap px-2 text-sm"
                icon={<PlusIcon size={18} className="max-lg:hidden" />}
                aria-label={t('pantry.jar.addToListLabel', { name: item.name, list: list.name })}
                onClick={onAddToList}
              >
                {t('pantry.jar.addToList')}
              </Button>
              <IconButton
                icon={<EditIcon size={18} />}
                label={t('pantry.jar.edit', { name: item.name })}
                onClick={onEdit}
                className="size-11"
              />
            </div>
          )
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 whitespace-nowrap px-2 text-sm"
              icon={<CheckIcon size={18} />}
              aria-label={t('pantry.jar.usedItLabel', { name: item.name })}
              onClick={onUsed}
            >
              {t('pantry.jar.usedIt')}
            </Button>
            <IconButton
              icon={<EditIcon size={18} />}
              label={t('pantry.jar.edit', { name: item.name })}
              onClick={onEdit}
              className="size-11"
            />
          </div>
        )}
      </article>
    </li>
  );
}
