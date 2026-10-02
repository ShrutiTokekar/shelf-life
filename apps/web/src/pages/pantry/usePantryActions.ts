import {
  addDays,
  applyUsedIt,
  estimateFoodExpiry,
  foodByName,
  daysLeft,
  newId,
  type Activity,
  type ActivityType,
  type ItemForm,
  type ListWithRole,
  type PantryItem,
} from '@shelf-life/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Y from 'yjs';
import { useToast } from '../../components/Toast/Toast';
import { aiShelfLives } from '../../lib/api';
import { getDoc, listDocName } from '../../lib/sync/docs';
import {
  addItems,
  addListItem,
  readItem,
  recordActivity,
  removeActivity,
  removeItem,
  removeListItem,
  restoreItem,
  updateItem,
} from '@shelf-life/docs';

/** Every pantry write goes through here so each one gets its toast and Undo (PAN-8). */
export function usePantryActions(opts: {
  doc: Y.Doc | null;
  pantryId: string;
  userId: string;
  today: string;
  lists: readonly ListWithRole[];
}) {
  const { doc, pantryId, userId, today, lists } = opts;
  const { t } = useTranslation();
  const toast = useToast();
  const undoLabel = t('pantry.toast.undo');

  /** Undo restores the item and removes any activity entries the action wrote. */
  const undoable = useCallback(
    (
      message: string,
      before: PantryItem | null,
      activityIds: string[] = [],
      /** Something else the action changed (e.g. Today's progress), undone with it. */
      alsoUndo?: () => void,
    ) => {
      toast({
        message,
        action:
          before && doc
            ? {
                label: undoLabel,
                onAction: () =>
                  doc.transact(() => {
                    restoreItem(doc, before);
                    removeActivity(doc, activityIds);
                    alsoUndo?.();
                  }),
              }
            : undefined,
      });
    },
    [doc, toast, undoLabel],
  );

  /** SRS 8.7 activity entries for "Used it" / "Ran out" (read by stats and reminders later). */
  const activity = useCallback(
    (item: PantryItem, type: ActivityType): Activity => ({
      id: newId(),
      pantryId,
      listId: item.listId,
      actorId: userId,
      type,
      subject: item.name,
      itemId: item.id,
      beforeExpiry: type === 'used' ? daysLeft(item, today) >= 0 : null,
      createdAt: new Date().toISOString(),
    }),
    [pantryId, userId, today],
  );

  const usedIt = useCallback(
    (item: PantryItem, alsoUndo?: () => void) => {
      if (!doc) return;
      const result = applyUsedIt(item, today);
      const entries = [
        activity(item, 'used'),
        ...(result.ranOut ? [activity(item, 'ran_out')] : []),
      ];
      let before: PantryItem | null = null;
      doc.transact(() => {
        before = updateItem(doc, item.id, result.patch);
        if (before) recordActivity(doc, entries);
      });
      undoable(
        result.ranOut
          ? t('pantry.toast.ranOut', { name: item.name })
          : t('pantry.toast.usedOne', { name: item.name, left: result.patch.quantity }),
        before,
        entries.map((e) => e.id),
        alsoUndo,
      );
    },
    [doc, today, t, undoable, activity],
  );

  const ranOut = useCallback(
    (item: PantryItem) => {
      if (!doc) return;
      const entry = activity(item, 'ran_out');
      let before: PantryItem | null = null;
      doc.transact(() => {
        before = updateItem(doc, item.id, { quantity: 0, status: 'out', outAt: today });
        if (before) recordActivity(doc, [entry]);
      });
      undoable(t('pantry.toast.ranOut', { name: item.name }), before, [entry.id]);
    },
    [doc, today, t, undoable, activity],
  );

  const remove = useCallback(
    (item: PantryItem) => {
      if (!doc) return;
      undoable(t('pantry.toast.deleted', { name: item.name }), removeItem(doc, item.id));
    },
    [doc, t, undoable],
  );

  const save = useCallback(
    (form: ItemForm, estimated: boolean, existing: PantryItem | null) => {
      if (!doc) return;
      const expiry = {
        expiryIsEstimate: estimated,
        expirySource: estimated ? ('category_default' as const) : ('user' as const),
      };
      if (!existing) {
        // SRS 8.3: a food the dictionary knows uses its shelf life; for anything else an AI
        // estimate is asked for below (online), and the category default stays as the fallback.
        const food = estimated ? foodByName(form.name) : undefined;
        const known = food ? estimateFoodExpiry(food, form.location, today) : null;
        const item: PantryItem = {
          id: newId(),
          pantryId,
          foodId: food?.foodId ?? null,
          ...form,
          ...expiry,
          ...(known ? { expiresOn: known.expiresOn, expirySource: known.source } : {}),
          purchasedOn: today,
          status: form.quantity === 0 ? 'out' : 'active',
          outAt: form.quantity === 0 ? today : null,
          addedBy: userId,
          receiptLineId: null,
          updatedAt: new Date().toISOString(),
        };
        addItems(doc, [item]);
        if (estimated && !food) {
          void aiShelfLives(pantryId, [{ name: item.name, location: item.location }]).then(
            (answers) => {
              const estimate = answers?.[0];
              const current = estimate ? readItem(doc, item.id) : null;
              // Only if nobody has changed the date since.
              if (estimate && current?.expirySource === 'category_default')
                updateItem(doc, item.id, {
                  expiresOn: addDays(today, estimate.days),
                  expirySource: 'ai',
                });
            },
          );
        }
        toast({
          message: t('pantry.toast.added', { name: item.name }),
          action: { label: undoLabel, onAction: () => removeItem(doc, item.id) },
        });
        return;
      }
      // Quantity 0 runs an item out (SRS 8.6); giving a ran-out item a quantity restocks it.
      const out = form.quantity === 0;
      const status = out ? 'out' : existing.status === 'out' ? 'active' : existing.status;
      const outAt = out ? (existing.outAt ?? today) : null;
      // Editing the quantity to 0 is a ran-out too (SRS 8.6).
      const entries = out && existing.status !== 'out' ? [activity(existing, 'ran_out')] : [];
      let before: PantryItem | null = null;
      doc.transact(() => {
        before = updateItem(doc, existing.id, { ...form, ...expiry, status, outAt });
        if (before && entries.length) recordActivity(doc, entries);
      });
      undoable(
        t('pantry.toast.saved', { name: form.name }),
        before,
        entries.map((e) => e.id),
      );
    },
    [doc, pantryId, today, userId, t, toast, undoLabel, undoable, activity],
  );

  /** PAN-9: add a ran-out item to its own list (or home, if you can only view that list). */
  const addToList = useCallback(
    /** `claim`: Today's "Add & claim" puts the user's name on it straight away (LST-5). */
    async (item: PantryItem, opts: { claim?: boolean; alsoUndo?: () => void } = {}) => {
      const own = lists.find((l) => l.id === item.listId && l.role !== 'view');
      const target = own ?? lists.find((l) => l.isHome) ?? lists[0];
      if (!target) return;
      const handle = getDoc(listDocName(target.id));
      try {
        await handle.ready;
      } catch {
        toast({
          message: t('pantry.toast.listUnavailable', { name: item.name, list: target.name }),
        });
        return;
      }
      const entryId = newId();
      addListItem(handle.doc, {
        id: entryId,
        listId: target.id,
        name: item.name,
        quantity: null,
        unit: '',
        note: '',
        reason: 'ran_out',
        recipeId: null,
        pantryItemId: item.id,
        addedBy: userId,
        claimedBy: opts.claim ? userId : null,
        checked: false,
        checkedBy: null,
        checkedAt: null,
        createdAt: new Date().toISOString(),
      });
      toast({
        message: t('pantry.toast.addedToList', { name: item.name, list: target.name }),
        action: {
          label: undoLabel,
          onAction: () => {
            removeListItem(handle.doc, entryId);
            opts.alsoUndo?.();
          },
        },
      });
    },
    [lists, userId, t, toast, undoLabel],
  );

  return { usedIt, ranOut, remove, save, addToList };
}
