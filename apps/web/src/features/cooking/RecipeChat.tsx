import type { Recipe } from '@shelf-life/shared';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../../components/Chat/ChatPanel';
import type { usePantryRecipes } from '../recipes/useRecipes';
import { useRecipeChat } from './useRecipeChat';

/**
 * RCP-8 chat wired to a recipe as cooked in this session: context line, suggestion chips
 * (Exact amounts, I'm missing something, Make it for N, Explain step N) and the actions.
 */
export function RecipeChat({
  base,
  recipe,
  servings,
  step,
  data,
  showTitle,
  className,
}: {
  base: Recipe;
  recipe: Recipe;
  servings: number;
  step: number | null;
  data: ReturnType<typeof usePantryRecipes>;
  showTitle?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const chat = useRecipeChat({ base, recipe, servings, step, data });
  const diet =
    data.prefs.diet === 'any'
      ? t(`recipes.diets.${recipe.diet}`).toLowerCase()
      : t(`profile.ai.diets.${data.prefs.diet}`).toLowerCase();
  const suggestions = [
    t('chat.suggest.amounts'),
    t('chat.suggest.missing'),
    t('chat.suggest.servings', { count: servings * 2 }),
    t('chat.suggest.explain', { n: step ?? Math.min(2, recipe.steps.length) }),
  ];
  return (
    <ChatPanel
      context={t('chat.context', { count: chat.pantryCount, servings, diet })}
      messages={chat.messages}
      suggestions={suggestions}
      pending={chat.pending}
      problem={chat.problem}
      online={data.online}
      onSend={(text) => void chat.send(text)}
      onAction={chat.apply}
      showTitle={showTitle}
      className={className}
    />
  );
}
