import { matchRecipe, rankRecipes } from '@shelf-life/ranking';
import { addDays, DEFAULT_RECIPE_PREFS, type PantryItem } from '@shelf-life/shared';
import { LOCAL_RECIPES } from '@shelf-life/shared/recipes';
import { useState } from 'react';
import { whySentence } from '../../features/recipes/text';
import i18n from '../../lib/i18n';
import { CUISINES } from '@shelf-life/shared';
import { HeartButton } from './HeartButton';
import { RecipeHeroCard, RecipeRow, SavedRecipeCard } from './RecipeCards';
import { RecipeTile } from './RecipeTile';

const TODAY = '2026-10-01';
const item = (foodId: string, name: string, days: number): PantryItem => ({
  id: foodId,
  pantryId: 'p',
  listId: 'l',
  foodId,
  name,
  category: 'produce',
  location: 'fridge',
  quantity: 1,
  unit: '',
  note: '',
  purchasedOn: TODAY,
  expiresOn: addDays(TODAY, days),
  expiryIsEstimate: true,
  expirySource: 'dictionary',
  status: 'active',
  outAt: null,
  addedBy: 'u',
  receiptLineId: null,
  updatedAt: '',
});
const pantry = [
  item('spinach', 'Spinach', 0),
  item('paneer', 'Paneer', 3),
  item('cilantro', 'Cilantro', 2),
  item('tortillas', 'Tortillas', 2),
  item('onion', 'Onion', 20),
];
const ranked = rankRecipes({
  recipes: LOCAL_RECIPES,
  pantry,
  listItems: [],
  today: TODAY,
  prefs: DEFAULT_RECIPE_PREFS,
});

export const ForTonight = () => {
  const [saved, setSaved] = useState(false);
  const top = ranked[0]!;
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <RecipeHeroCard
        ranked={top}
        why={whySentence(i18n.t, top.why)}
        saveButton={
          <HeartButton title={top.recipe.title} saved={saved} onToggle={() => setSaved(!saved)} />
        }
        onAddMissing={() => undefined}
      />
      <ol className="rounded-hero bg-white bordered">
        {ranked.slice(1, 4).map((r, i) => (
          <RecipeRow
            key={r.recipe.id}
            ranked={r}
            rank={i + 2}
            note={{ tone: 'claimed', text: 'Onions: Arjun is buying them' }}
          />
        ))}
      </ol>
    </div>
  );
};

export const Saved = () => {
  const m = matchRecipe(LOCAL_RECIPES[0]!, pantry, [], TODAY);
  return (
    <ul className="grid max-w-3xl gap-3">
      <SavedRecipeCard
        ranked={{ ...m, score: 0, why: [] }}
        status={<span className="text-sm">Spinach expires today</span>}
        saveButton={<HeartButton title={m.recipe.title} saved onToggle={() => undefined} />}
      />
    </ul>
  );
};

export const CuisineTiles = () => (
  <div className="flex flex-wrap gap-3">
    {CUISINES.map((c) => (
      <RecipeTile key={c} cuisine={c} className="size-24" />
    ))}
  </div>
);
