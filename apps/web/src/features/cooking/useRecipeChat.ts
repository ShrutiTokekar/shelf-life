import type { ChatAction, Recipe } from '@shelf-life/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast/Toast';
import { aiChat } from '../../lib/api';
import { useCookSession } from '../../stores/cookSession';
import { useRecipeActions } from '../recipes/useRecipeActions';
import type { usePantryRecipes } from '../recipes/useRecipes';

export type ChatProblem = 'offline' | 'unavailable' | 'limit' | null;

/**
 * RCP-8 recipe chat for the recipe as cooked in this session. Sends item names, servings, the
 * current step and preferences (SRS 9.1); applies reply actions (swap, add to list, servings,
 * update recipe) only when the cook taps them.
 */
export function useRecipeChat(opts: {
  base: Recipe;
  recipe: Recipe;
  servings: number;
  step: number | null;
  data: ReturnType<typeof usePantryRecipes>;
}) {
  const { base, recipe, servings, step, data } = opts;
  const { t } = useTranslation();
  const toast = useToast();
  const chat = useCookSession((s) => s.chats[base.id]);
  const { appendChat, markApplied, addSwap, setUpdate, setServings } = useCookSession.getState();
  const { addMissing } = useRecipeActions(data.lists);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ChatProblem>(null);
  const pantry = [
    ...new Set(data.items.filter((i) => i.status === 'active').map((i) => i.name)),
  ].slice(0, 120);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || pending) return;
      setProblem(null);
      appendChat(base.id, [{ role: 'user', text: message, actions: [] }]);
      setPending(true);
      const outcome = await aiChat({
        pantryId: data.pantry.id,
        threadId: useCookSession.getState().chats[base.id]?.threadId ?? null,
        recipe,
        step,
        servings,
        preferences: data.prefs,
        pantry,
        message,
      });
      setPending(false);
      if (!outcome.ok) {
        setProblem(outcome.reason);
        return;
      }
      appendChat(
        base.id,
        [{ role: 'ai', text: outcome.response.reply, actions: outcome.response.actions }],
        outcome.response.threadId,
      );
    },
    [pending, appendChat, base.id, data.pantry.id, data.prefs, recipe, step, servings, pantry],
  );

  const apply = useCallback(
    (action: ChatAction, messageIndex: number, actionIndex: number) => {
      switch (action.type) {
        case 'swap':
          addSwap(base.id, { from: action.from, to: action.to, amount: action.amount });
          toast({ message: t('chat.applied.swap', { to: action.to, from: action.from }) });
          break;
        case 'addToList':
          void addMissing({ name: action.name, amount: null, unit: null }, base);
          break;
        case 'updateServings':
          setServings(base.id, action.servings);
          toast({ message: t('chat.applied.servings', { count: action.servings }) });
          break;
        case 'updateRecipe':
          setUpdate(base.id, {
            summary: action.summary,
            servings,
            ...(action.ingredients ? { ingredients: action.ingredients } : {}),
            ...(action.steps ? { steps: action.steps } : {}),
          });
          toast({ message: t('chat.applied.recipe', { summary: action.summary }) });
          break;
      }
      markApplied(base.id, messageIndex, actionIndex);
    },
    [addSwap, addMissing, setServings, setUpdate, markApplied, base, servings, toast, t],
  );

  return {
    messages: chat?.messages ?? [],
    pending,
    problem,
    send,
    apply,
    pantryCount: pantry.length,
  };
}
