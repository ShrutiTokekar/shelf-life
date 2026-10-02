import { addListItem, removeListItem } from '@shelf-life/docs';
import { newId, type ListWithRole, type Recipe, type RecipeIngredient } from '@shelf-life/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast/Toast';
import { useMe } from '../../lib/session';
import { getDoc, listDocName } from '../../lib/sync/docs';
import { useRecipeStore } from '../../stores/recipes';
import { sendSaved } from './useRecipeSync';

/** Save/unsave (SAV-2, with undo) and "Add to list" for a missing ingredient (REC-3, RCP-3). */
export function useRecipeActions(lists: readonly ListWithRole[]) {
  const { t } = useTranslation();
  const toast = useToast();
  const me = useMe();
  const toggleSaved = useRecipeStore((s) => s.toggleSaved);

  const toggleSave = useCallback(
    (recipe: Recipe) => {
      const now = toggleSaved(recipe);
      void sendSaved(recipe.id);
      toast({
        message: t(now ? 'recipes.toast.saved' : 'recipes.toast.unsaved', { title: recipe.title }),
        action: {
          label: t('recipes.toast.undo'),
          onAction: () => {
            toggleSaved(recipe);
            void sendSaved(recipe.id);
          },
        },
      });
    },
    [toggleSaved, toast, t],
  );

  const addMissing = useCallback(
    async (ingredient: RecipeIngredient, recipe: Recipe) => {
      const target =
        lists.find((l) => l.isHome && l.role !== 'view') ?? lists.find((l) => l.role !== 'view');
      if (!target) return;
      const handle = getDoc(listDocName(target.id));
      try {
        await handle.ready;
      } catch {
        toast({ message: t('recipes.toast.listUnavailable', { list: target.name }) });
        return;
      }
      const id = newId();
      addListItem(handle.doc, {
        id,
        listId: target.id,
        name: ingredient.name,
        quantity: null,
        unit: '',
        note: '',
        reason: 'recipe',
        recipeId: recipe.id,
        pantryItemId: null,
        addedBy: me.user.id,
        claimedBy: null,
        checked: false,
        checkedBy: null,
        checkedAt: null,
        createdAt: new Date().toISOString(),
      });
      toast({
        message: t('recipes.toast.added', { name: ingredient.name, list: target.name }),
        action: { label: t('recipes.toast.undo'), onAction: () => removeListItem(handle.doc, id) },
      });
    },
    [lists, me.user.id, toast, t],
  );

  return { toggleSave, addMissing };
}
