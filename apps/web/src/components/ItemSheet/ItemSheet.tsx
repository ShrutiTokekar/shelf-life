import {
  CATEGORIES,
  DEFAULT_LOCATION,
  estimateExpiry,
  itemFormSchema,
  LOCATIONS,
  type Category,
  type ItemForm,
  type ListColor,
  type Location,
  type PantryItem,
} from '@shelf-life/shared';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../Button/Button';
import { categoryIcon } from '../CategoryChips/CategoryChips';
import { EmptyJarIcon, JarIcon, TrashIcon, WarnIcon } from '../icons';
import { listDotClass } from '../PantryLabel/PantryLabel';
import { Select } from '../Select/Select';

export type SheetList = { id: string; name: string; color: ListColor };

export type ItemSheetProps = {
  open: boolean;
  mode: 'add' | 'edit';
  /** The item being edited (edit mode). */
  item?: PantryItem | null;
  lists: readonly SheetList[];
  defaultListId: string;
  today: string;
  onClose: () => void;
  /** `estimated` is true when the date is still the category default the user didn't change. */
  onSave: (form: ItemForm, meta: { estimated: boolean }) => void;
  onRanOut?: () => void;
  /** SRS 8.6: mark or unmark "Running low" (shows on Reminders). */
  onRunningLow?: (low: boolean) => void;
  onDelete?: () => void;
  /** The review screen sets one pantry label for the whole receipt (REV-6), so it hides this. */
  hideList?: boolean;
};

type Draft = {
  name: string;
  quantity: string;
  unit: string;
  location: Location;
  category: Category;
  listId: string;
  expiresOn: string;
  note: string;
};

function draftFrom(
  item: PantryItem | null | undefined,
  defaultListId: string,
  today: string,
): Draft {
  if (item) {
    return {
      name: item.name,
      quantity: item.quantity === null ? '' : String(item.quantity),
      unit: item.unit,
      location: item.location,
      category: item.category,
      listId: item.listId,
      expiresOn: item.expiresOn,
      note: item.note,
    };
  }
  return {
    name: '',
    quantity: '1',
    unit: '',
    location: DEFAULT_LOCATION.produce,
    category: 'produce',
    listId: defaultListId,
    expiresOn: estimateExpiry('produce', DEFAULT_LOCATION.produce, today),
    note: '',
  };
}

/** Add / edit item sheet (SRS 7 ItemSheet, PAN-8, PAN-11). */
export function ItemSheet(props: ItemSheetProps) {
  const { t } = useTranslation();
  const title =
    props.mode === 'add'
      ? t('itemSheet.addTitle')
      : t('itemSheet.editTitle', { name: props.item?.name ?? '' });
  return (
    <BottomSheet open={props.open} title={title} onClose={props.onClose}>
      {/* Remount the form for each item so it starts from that item's values. */}
      {props.open ? <ItemSheetForm key={props.item?.id ?? 'new'} {...props} /> : null}
    </BottomSheet>
  );
}

function ItemSheetForm({
  mode,
  item,
  lists,
  defaultListId,
  today,
  onClose,
  onSave,
  onRanOut,
  onRunningLow,
  onDelete,
  hideList = false,
}: ItemSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, defaultListId, today));
  // In add mode the date follows category and location until the user picks one (SRS 8.3).
  const [dateTouched, setDateTouched] = useState(mode === 'edit' && !item?.expiryIsEstimate);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const ids = {
    name: useId(),
    quantity: useId(),
    unit: useId(),
    unitHint: useId(),
    date: useId(),
    dateHint: useId(),
    note: useId(),
    err: useId(),
  };

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (!dateTouched && (key === 'category' || key === 'location')) {
        next.expiresOn = estimateExpiry(next.category, next.location, item?.purchasedOn ?? today);
      }
      if (mode === 'add' && key === 'category') {
        next.location = DEFAULT_LOCATION[value as Category];
        if (!dateTouched) next.expiresOn = estimateExpiry(next.category, next.location, today);
      }
      return next;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const qtyText = draft.quantity.trim();
    const quantity = qtyText === '' ? null : Number(qtyText.replace(',', '.'));
    const nextErrors: Partial<Record<keyof Draft, string>> = {};
    if (quantity !== null && !Number.isFinite(quantity))
      nextErrors.quantity = t('itemSheet.errors.quantity');
    const parsed = itemFormSchema.safeParse({
      ...draft,
      quantity: Number.isFinite(quantity) ? quantity : null,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Draft;
        nextErrors[key] ??= issue.message;
      }
    }
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0] as keyof Draft | undefined;
    if (first || !parsed.success) {
      const target =
        first === 'quantity' ? ids.quantity : first === 'expiresOn' ? ids.date : ids.name;
      document.getElementById(target)?.focus();
      return;
    }
    onSave(parsed.data, { estimated: !dateTouched });
  }

  const listOptions = lists.map((l) => ({
    value: l.id,
    label: l.name,
    icon: <span aria-hidden="true" className={`size-2.5 rounded-chip ${listDotClass[l.color]}`} />,
  }));

  const field =
    'min-h-12 w-full rounded-button bg-white px-4 text-base text-ink bordered aria-invalid:border-terra-dark';

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="font-semibold text-ink">
          {t('itemSheet.name')}
        </label>
        <input
          id={ids.name}
          value={draft.name}
          autoComplete="off"
          maxLength={60}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${ids.name}-err` : undefined}
          onChange={(e) => set('name', e.target.value)}
          className={field}
        />
        <FieldError id={`${ids.name}-err`} message={errors.name} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.quantity} className="font-semibold text-ink">
            {t('itemSheet.quantity')}
          </label>
          <input
            id={ids.quantity}
            inputMode="decimal"
            value={draft.quantity}
            aria-invalid={errors.quantity ? true : undefined}
            aria-describedby={errors.quantity ? `${ids.quantity}-err` : undefined}
            onChange={(e) => set('quantity', e.target.value)}
            className={field}
          />
          <FieldError id={`${ids.quantity}-err`} message={errors.quantity} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.unit} className="font-semibold text-ink">
            {t('itemSheet.unit')}
          </label>
          <input
            id={ids.unit}
            value={draft.unit}
            maxLength={20}
            aria-describedby={ids.unitHint}
            onChange={(e) => set('unit', e.target.value)}
            className={field}
          />
        </div>
        <p id={ids.unitHint} className="col-span-2 -mt-1 text-sm text-secondary">
          {t('itemSheet.unitHint')}
        </p>
      </div>

      <Select
        label={t('itemSheet.category')}
        value={draft.category}
        onChange={(v) => set('category', v as Category)}
        options={CATEGORIES.map((c) => ({
          value: c,
          label: t(`categories.${c}`),
          icon: categoryIcon[c],
        }))}
      />
      <Select
        label={t('itemSheet.location')}
        value={draft.location}
        onChange={(v) => set('location', v as Location)}
        options={LOCATIONS.map((l) => ({ value: l, label: t(`locations.${l}`) }))}
      />
      {hideList ? null : (
        <Select
          label={t('itemSheet.list')}
          hint={t('itemSheet.listHint')}
          value={draft.listId}
          onChange={(v) => set('listId', v)}
          options={listOptions}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.date} className="font-semibold text-ink">
          {t('itemSheet.expiresOn')}
        </label>
        <input
          id={ids.date}
          type="date"
          value={draft.expiresOn}
          aria-invalid={errors.expiresOn ? true : undefined}
          aria-describedby={
            [!dateTouched ? ids.dateHint : '', errors.expiresOn ? `${ids.date}-err` : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          onChange={(e) => {
            setDateTouched(true);
            set('expiresOn', e.target.value);
          }}
          className={field}
        />
        {!dateTouched ? (
          <p id={ids.dateHint} className="text-sm text-secondary">
            {t('itemSheet.estimated')}
          </p>
        ) : null}
        <FieldError id={`${ids.date}-err`} message={errors.expiresOn} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.note} className="font-semibold text-ink">
          {t('itemSheet.note')}
        </label>
        <textarea
          id={ids.note}
          value={draft.note}
          maxLength={200}
          rows={2}
          onChange={(e) => set('note', e.target.value)}
          className={`${field} py-3`}
        />
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row-reverse">
        <Button type="submit" fullWidth>
          {mode === 'add' ? t('itemSheet.add') : t('itemSheet.save')}
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          {t('itemSheet.cancel')}
        </Button>
      </div>

      {mode === 'edit' ? (
        <div className="flex flex-col gap-3 border-t-2 border-line pt-5 sm:flex-row">
          {item?.status !== 'out' && onRanOut ? (
            <Button
              variant="secondary"
              fullWidth
              icon={<EmptyJarIcon size={18} />}
              onClick={onRanOut}
            >
              {t('itemSheet.ranOut')}
            </Button>
          ) : null}
          {item?.status === 'active' && onRunningLow ? (
            <Button
              variant="secondary"
              fullWidth
              icon={<JarIcon size={18} />}
              onClick={() => onRunningLow(!item.lowAt)}
            >
              {item.lowAt ? t('itemSheet.notLow') : t('itemSheet.runningLow')}
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="danger" fullWidth icon={<TrashIcon size={18} />} onClick={onDelete}>
              {t('itemSheet.delete')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-center gap-2 text-sm font-medium text-terra-dark">
      <WarnIcon size={18} />
      {message}
    </p>
  );
}
