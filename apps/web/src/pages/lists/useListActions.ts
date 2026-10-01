import { addListItem, markDoneShopping, removeListItem, updateListItem } from '@shelf-life/docs';
import {
  checkPatch,
  claimPatch,
  newListItem,
  unclaimPatch,
  type ListItem,
  type ParsedListEntry,
  type PantryItem,
} from '@shelf-life/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Y from 'yjs';
import { useToast } from '../../components/Toast/Toast';

type Entry = ParsedListEntry & { note?: string; claimedBy?: string | null };

/**
 * Every list write (SRS 6.6), local first and synced by the doc's provider (LST-10). Each one
 * that changes something for others gets a toast with Undo.
 */
export function useListActions(doc: Y.Doc | null, listId: string, userId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const undo = t('lists.undo');
  const now = () => new Date().toISOString();

  const add = useCallback(
    (entries: Entry[], extra: Partial<Pick<ListItem, 'reason' | 'pantryItemId'>> = {}) => {
      if (!doc || entries.length === 0) return;
      const items = entries.map((e) => newListItem(e, { listId, userId, now: now() }, extra));
      doc.transact(() => items.forEach((i) => addListItem(doc, i)));
      const names = items.map((i) => i.name).join(', ');
      toast({
        message: t('lists.addedToast', { count: items.length, names }),
        action: {
          label: undo,
          onAction: () => doc.transact(() => items.forEach((i) => removeListItem(doc, i.id))),
        },
      });
    },
    [doc, listId, userId, t, toast, undo],
  );

  /** ADD-3 / LST-2 "Ran out recently" chip: back on the list, linked to its jar (PAN-9). */
  const addRanOut = useCallback(
    (jar: PantryItem) =>
      add([{ name: jar.name, quantity: null, unit: '' }], {
        reason: 'ran_out',
        pantryItemId: jar.id,
      }),
    [add],
  );

  const claim = useCallback(
    (item: ListItem) => {
      if (!doc) return;
      updateListItem(doc, item.id, claimPatch(userId));
      toast({
        message: t('lists.claim.claimedToast', { name: item.name }),
        action: { label: undo, onAction: () => updateListItem(doc, item.id, unclaimPatch()) },
      });
    },
    [doc, userId, t, toast, undo],
  );

  /** LST-7: checking moves it to the cart; unchecking brings it back. */
  const check = useCallback(
    (item: ListItem) => {
      if (doc) updateListItem(doc, item.id, checkPatch(item, userId, now()));
    },
    [doc, userId],
  );

  const edit = useCallback(
    (item: ListItem, patch: Partial<ListItem>) => {
      if (!doc) return;
      const before = updateListItem(doc, item.id, patch);
      if (before)
        toast({
          message: t('pantry.toast.saved', { name: patch.name ?? item.name }),
          action: { label: undo, onAction: () => updateListItem(doc, item.id, before) },
        });
    },
    [doc, t, toast, undo],
  );

  const remove = useCallback(
    (item: ListItem) => {
      if (!doc) return;
      removeListItem(doc, item.id);
      toast({
        message: t('pantry.toast.deleted', { name: item.name }),
        action: { label: undo, onAction: () => addListItem(doc, item) },
      });
    },
    [doc, t, toast, undo],
  );

  /** LST-7: the sync service moves the cart into the pantry when it sees this. */
  const doneShopping = useCallback(() => {
    if (!doc) return;
    markDoneShopping(doc, userId, now());
    toast({ message: t('lists.doneToast') });
  }, [doc, userId, t, toast]);

  return { add, addRanOut, claim, check, edit, remove, doneShopping };
}
