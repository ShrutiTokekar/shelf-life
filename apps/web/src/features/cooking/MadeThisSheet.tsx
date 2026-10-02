import { recordActivity, removeActivity, restoreItem, updateItem } from '@shelf-life/docs';
import type { UsedItem } from '@shelf-life/ranking';
import {
  applyCooked,
  daysLeft,
  formatAmount,
  isCountable,
  newId,
  suggestedUse,
  type Activity,
  type CookedChoice,
  type PantryItem,
  type Recipe,
} from '@shelf-life/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Y from 'yjs';
import { BottomSheet } from '../../components/BottomSheet/BottomSheet';
import { Button } from '../../components/Button/Button';
import { CheckIcon } from '../../components/icons';
import { useToast } from '../../components/Toast/Toast';

type Choice = { kind: 'all' } | { kind: 'some'; left: string };

/** A sensible first answer: what the recipe used when units match, else ask (SRS 8.10). */
function initialChoice(u: UsedItem): Choice {
  const s = suggestedUse(u.item, u.ingredient);
  if (s) return s.left === 0 ? { kind: 'all' } : { kind: 'some', left: String(s.left) };
  // "1 bag" of spinach for 300 g: probably finished. Bigger stocks: probably some left.
  if (isCountable(u.item) && (u.item.quantity ?? 0) <= 1) return { kind: 'all' };
  return { kind: 'some', left: '' };
}

const parseLeft = (text: string): number | null => {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n;
};

/**
 * RCP-10 "I made this": for each pantry item the recipe used, "Used it all" or "Some left" (with
 * how much, when the units let us say). Saving updates the pantry, runs out finished items
 * (SRS 8.6) and records a `cooked` event for History and impact stats. One Undo for all of it.
 */
export function MadeThisSheet({
  open,
  onClose,
  recipe,
  used,
  doc,
  pantryId,
  homeListId,
  userId,
  today,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  used: readonly UsedItem[];
  doc: Y.Doc | null;
  pantryId: string;
  homeListId: string;
  userId: string;
  today: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(used.map((u) => [u.item.id, initialChoice(u)])),
  );
  const choiceOf = (u: UsedItem) => choices[u.item.id] ?? initialChoice(u);
  const set = (id: string, c: Choice) => setChoices((cs) => ({ ...cs, [id]: c }));

  function save() {
    if (!doc) return;
    const now = new Date().toISOString();
    const entry = (item: PantryItem, type: Activity['type']): Activity => ({
      id: newId(),
      pantryId,
      listId: item.listId,
      actorId: userId,
      type,
      subject: item.name,
      itemId: item.id,
      beforeExpiry: type === 'used' ? daysLeft(item, today) >= 0 : null,
      createdAt: now,
    });
    const cooked: Activity = {
      id: newId(),
      pantryId,
      listId: homeListId,
      actorId: userId,
      type: 'cooked',
      subject: recipe.title,
      itemId: null,
      beforeExpiry: null,
      recipeId: recipe.id,
      createdAt: now,
    };
    const entries: Activity[] = [cooked];
    const before: PantryItem[] = [];
    let ranOut = 0;
    doc.transact(() => {
      for (const u of used) {
        const c = choiceOf(u);
        const choice: CookedChoice =
          c.kind === 'all' ? c : { kind: 'some', left: parseLeft(c.left) };
        const result = applyCooked(u.item, choice, today);
        entries.push(entry(u.item, 'used'));
        if (!result) continue;
        const prev = updateItem(doc, u.item.id, result.patch);
        if (prev) before.push(prev);
        if (result.ranOut) {
          ranOut++;
          entries.push(entry(u.item, 'ran_out'));
        }
      }
      recordActivity(doc, entries);
    });
    onClose();
    toast({
      message:
        ranOut > 0
          ? t('cook.made.toastRanOut', { title: recipe.title, count: ranOut })
          : t('cook.made.toast', { title: recipe.title }),
      action: {
        label: t('pantry.toast.undo'),
        onAction: () =>
          doc.transact(() => {
            for (const b of before) restoreItem(doc, b);
            removeActivity(
              doc,
              entries.map((e) => e.id),
            );
          }),
      },
    });
  }

  return (
    <BottomSheet open={open} title={t('cook.made.title')} onClose={onClose}>
      <p className="text-secondary">
        {used.length > 0 ? t('cook.made.body') : t('cook.made.bodyNone')}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {used.map((u) => (
          <UsedRow
            key={u.item.id}
            used={u}
            choice={choiceOf(u)}
            onChange={(c) => set(u.item.id, c)}
          />
        ))}
      </ul>
      <Button fullWidth className="mt-5" icon={<CheckIcon size={20} />} onClick={save}>
        {t('cook.made.save')}
      </Button>
    </BottomSheet>
  );
}

function UsedRow({
  used,
  choice,
  onChange,
}: {
  used: UsedItem;
  choice: Choice;
  onChange: (c: Choice) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const leftId = useId();
  const { item, ingredient } = used;
  const known = suggestedUse(item, ingredient);
  const unit = item.unit.trim();
  return (
    <li className="rounded-card bg-white p-4 bordered">
      <fieldset>
        <legend className="font-semibold">
          {item.name}
          {item.quantity !== null ? (
            <span className="font-normal text-secondary">
              {' · '}
              {t('cook.made.had', { amount: formatAmount(item.quantity), unit })}
            </span>
          ) : null}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['all', 'some'] as const).map((kind) => (
            <label
              key={kind}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-button px-3 bordered has-[:checked]:border-navy has-[:checked]:bg-periwinkle"
            >
              <input
                type="radio"
                name={name}
                checked={choice.kind === kind}
                onChange={() =>
                  onChange(
                    kind === 'all' ? { kind } : { kind, left: known ? String(known.left) : '' },
                  )
                }
                className="size-5 accent-[var(--navy)]"
              />
              {kind === 'all' ? t('cook.made.all') : t('cook.made.some')}
            </label>
          ))}
        </div>
        {choice.kind === 'some' ? (
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor={leftId} className="text-sm">
              {t('cook.made.left')}
            </label>
            <input
              id={leftId}
              inputMode="decimal"
              value={choice.left}
              placeholder={t('cook.made.leftUnknown')}
              onChange={(e) => onChange({ kind: 'some', left: e.target.value })}
              className="min-h-11 w-28 rounded-xl bg-white px-3 bordered"
            />
            {unit ? <span className="text-sm text-secondary">{unit}</span> : null}
          </div>
        ) : null}
      </fieldset>
    </li>
  );
}
