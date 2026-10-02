import { addItems, readListItems } from '@shelf-life/docs';
import { todayIso, type PantryItem, type Recipe } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { useRecipeStore } from '../../stores/recipes';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

const TODAY = todayIso();
async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
}

describe('RecipePage (SRS 6.15, Milestone 6 version)', () => {
  it('RCP-2 RCP-3 RCP-5 shows what it saves, have/missing ingredients and timed steps', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    await seed([
      pantryItem({ foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
      pantryItem({ foodId: 'paneer', name: 'Paneer', expiresOn: TODAY }),
    ]);
    const { container } = renderApp('/recipes/palak-paneer-quick', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Weeknight palak paneer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Saves 2 things before they go bad')).toBeInTheDocument();
    const rows = screen.getAllByTestId('ingredient');
    expect(rows[0]).toHaveTextContent('Spinach · 300 g');
    expect(rows[0]).toHaveTextContent('You have it');
    const onion = rows.find((r) => r.textContent?.startsWith('Onion'))!;
    expect(onion).toHaveTextContent('Missing');
    expect(rows.find((r) => r.textContent?.startsWith('Salt'))).toHaveTextContent('Kitchen basic');
    expect(rows.find((r) => r.textContent?.startsWith('Cumin'))).toHaveTextContent(
      'Spice or condiment · assumed on hand',
    );
    expect(screen.getByText('You have 2 of 6 ingredients')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /^Step 1:\s?Wilt the spinach$/ }),
    ).toBeVisible();
    expect(screen.getAllByText('Timer: 1 min')[0]).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);

    await userEvent.click(within(onion).getByRole('button', { name: 'Add Onion to the list' }));
    const list = getDoc(listDocName(returningUserMe.pantry!.homeListId));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)[0]).toMatchObject({ name: 'Onion', reason: 'recipe' }),
    );
  });

  it('AI recipes come from the API once, then open offline from the device', async () => {
    const recipe: Recipe = {
      id: '0192f0c0-0000-7000-8000-0000000000bb',
      source: 'ai',
      title: 'Quick spinach stir-fry',
      cuisine: 'everyday',
      minutes: 15,
      servings: 2,
      diet: 'vegan',
      ingredients: [{ name: 'Spinach', amount: null, unit: null }],
      steps: [{ title: 'Stir-fry', text: 'Stir-fry it.' }],
    };
    mockApi({ [`GET /recipes/${recipe.id}`]: recipe, 'GET /me/saved-recipes': { saved: [] } });
    renderApp(`/recipes/${recipe.id}`, returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quick spinach stir-fry' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Suggested by AI/)).toBeInTheDocument();
    expect(useRecipeStore.getState().seen[recipe.id]).toEqual(recipe);
  });

  it('unknown recipe: says so with a way back', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    renderApp('/recipes/nope', returningUserMe);
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t find that recipe.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to recipes' })).toHaveAttribute(
      'href',
      '/recipes',
    );
  });
});
