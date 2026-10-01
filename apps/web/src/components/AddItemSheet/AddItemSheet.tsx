import {
  parseListText,
  type ListItem,
  type ParsedListEntry,
  type PantryItem,
} from '@shelf-life/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import type { Person } from '../../lib/people';
import { Avatar } from '../Avatar/Avatar';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../Button/Button';
import { NoteIcon, PlusIcon, TrashIcon, UsersIcon, WarnIcon } from '../icons';
import { QuantityStepper } from '../QuantityStepper/QuantityStepper';
import { Select } from '../Select/Select';

export const LIST_UNITS = [
  'pack',
  'bag',
  'box',
  'bunch',
  'cartons',
  'bottle',
  'can',
  'jar',
  'dozen',
  'lb',
  'kg',
  'g',
  'oz',
  'gal',
  'L',
] as const;

export type SheetMember = Person & { userId: string; isYou: boolean };
export type NewEntry = ParsedListEntry & { note: string; claimedBy: string | null };

export type AddItemSheetProps = {
  open: boolean;
  /** Edit an existing row instead of adding. */
  item?: ListItem | null;
  listName: string;
  isPrivate: boolean;
  members: readonly SheetMember[];
  /** ADD-3 quick-add chips. */
  ranOut: readonly PantryItem[];
  onAdd: (entries: NewEntry[]) => void;
  onSave: (patch: Partial<ListItem>) => void;
  onDelete: () => void;
  onRanOut: (jar: PantryItem) => void;
  onClose: () => void;
};

/** Add item sheet (SRS 6.7, Figma mobile 09). Also edits a row. */
export function AddItemSheet(props: AddItemSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={props.open}
      title={props.item ? t('addSheet.editTitle', { name: props.item.name }) : t('addSheet.title')}
      onClose={props.onClose}
    >
      {props.open ? <AddItemForm key={props.item?.id ?? 'new'} {...props} /> : null}
    </BottomSheet>
  );
}

function AddItemForm({
  item,
  listName,
  isPrivate,
  members,
  ranOut,
  onAdd,
  onSave,
  onDelete,
  onRanOut,
}: AddItemSheetProps) {
  const { t } = useTranslation();
  const ids = { name: useId(), tip: useId(), err: useId(), note: useId(), who: useId() };
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [qtyTouched, setQtyTouched] = useState(item?.quantity != null);
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [who, setWho] = useState<string | null>(item?.claimedBy ?? null);
  const [note, setNote] = useState(item?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // ADD-1: focus moves to the item field on open.
  useEffect(() => nameRef.current?.focus(), []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const entries = parseListText(name);
    if (entries.length === 0) {
      setError(t('addSheet.nameRequired'));
      nameRef.current?.focus();
      return;
    }
    if (item) {
      const [first] = entries;
      onSave({
        name: first!.name,
        quantity: qtyTouched ? quantity : (first!.quantity ?? item.quantity),
        unit: unit || first!.unit,
        note: note.trim(),
        claimedBy: who,
      });
      return;
    }
    // One item: the stepper and unit apply. Several ("2 onions and eggs"): each keeps its own.
    onAdd(
      entries.map((entry) => ({
        ...entry,
        quantity: entries.length === 1 && qtyTouched ? quantity : entry.quantity,
        unit: entries.length === 1 && unit ? unit : entry.unit,
        note: entries.length === 1 ? note.trim() : '',
        claimedBy: who,
      })),
    );
  }

  const whoOptions: { value: string | null; label: string; person: SheetMember | null }[] = [
    { value: null, label: t('addSheet.anyone'), person: null },
    ...members.map((m) => ({
      value: m.userId,
      label: m.isYou ? t('addSheet.you') : m.name.split(' ')[0]!,
      person: m,
    })),
  ];

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="sr-only">
          {t('addSheet.name')}
        </label>
        <input
          ref={nameRef}
          id={ids.name}
          value={name}
          autoComplete="off"
          maxLength={200}
          placeholder={t('lists.addPlaceholder')}
          aria-invalid={error ? true : undefined}
          aria-describedby={[ids.tip, error ? ids.err : ''].filter(Boolean).join(' ')}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          className="min-h-12 w-full rounded-button bg-white px-4 text-lg text-ink bordered aria-invalid:border-terra-dark"
        />
        <p id={ids.tip} className="text-sm text-secondary">
          {t('addSheet.tip')}
        </p>
        {error ? (
          <p id={ids.err} className="flex items-center gap-2 text-sm font-medium text-terra-dark">
            <WarnIcon size={16} />
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="font-semibold text-ink">{t('addSheet.quantity')}</span>
        <div className="flex items-end gap-3">
          <QuantityStepper
            label={t('addSheet.quantity')}
            name={name}
            value={quantity}
            onChange={(v) => {
              setQuantity(v);
              setQtyTouched(true);
            }}
          />
          <Select
            className="w-32 [&>span:first-child]:sr-only"
            label={t('addSheet.unit')}
            value={unit || 'none'}
            onChange={(v) => setUnit(v === 'none' ? '' : v)}
            options={[
              { value: 'none', label: t('addSheet.noUnit') },
              ...LIST_UNITS.map((u) => ({ value: u, label: u })),
            ]}
          />
        </div>
      </div>

      {!isPrivate && members.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {t('addSheet.who')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {whoOptions.map((o) => {
              const checked = who === o.value;
              return (
                <label
                  key={o.value ?? 'anyone'}
                  className={cx(
                    'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-chip px-3.5 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy',
                    checked
                      ? 'border-2 border-navy bg-navy text-white'
                      : 'bg-white text-ink bordered',
                  )}
                >
                  <input
                    type="radio"
                    name={ids.who}
                    className="sr-only"
                    checked={checked}
                    onChange={() => setWho(o.value)}
                  />
                  {o.person ? (
                    <Avatar initial={o.person.initial} tone={o.person.tone} size={20} />
                  ) : (
                    <UsersIcon size={18} />
                  )}
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="relative">
        <label htmlFor={ids.note} className="sr-only">
          {t('addSheet.note')}
        </label>
        <NoteIcon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
        />
        <input
          id={ids.note}
          value={note}
          maxLength={200}
          placeholder={t('addSheet.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-12 w-full rounded-button bg-white pl-11 pr-4 text-base text-ink bordered"
        />
      </div>

      {!item && ranOut.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-ui text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {t('addSheet.ranOut')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {ranOut.map((jar) => (
              <button
                key={jar.id}
                type="button"
                onClick={() => onRanOut(jar)}
                aria-label={t('lists.ranOutChip', { name: jar.name })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-chip bg-peach px-3.5 text-sm font-semibold text-peach-dark"
              >
                <PlusIcon size={16} />
                {jar.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" fullWidth>
          {item ? t('addSheet.save') : isPrivate ? t('addSheet.addPrivate') : t('addSheet.add')}
        </Button>
        {!isPrivate && !item ? (
          <p className="text-center text-sm text-secondary">
            {t('addSheet.helper', { name: listName })}
          </p>
        ) : null}
        {item ? (
          <Button variant="danger" fullWidth icon={<TrashIcon size={18} />} onClick={onDelete}>
            {t('addSheet.delete')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
