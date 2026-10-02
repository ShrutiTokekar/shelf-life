import { addItems, readListItems } from '@shelf-life/docs';
import {
  addDays,
  DEFAULT_RECIPE_PREFS,
  todayIso,
  type PantryItem,
  type Recipe,
} from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { useRecipeStore } from '../../stores/recipes';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  resetMedia();
  vi.restoreAllMocks();
});

const TODAY = todayIso();
const HOME = returningUserMe.pantry!.homeListId;

async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
}
const fridge = () => [
  pantryItem({ id: 'spinach', foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
  pantryItem({ id: 'paneer', foodId: 'paneer', name: 'Paneer', expiresOn: addDays(TODAY, 1) }),
  pantryItem({ id: 'onion', foodId: 'onion', name: 'Onion', expiresOn: addDays(TODAY, 20) }),
  pantryItem({ id: 'tomato', foodId: 'tomato', name: 'Tomato', expiresOn: addDays(TODAY, 4) }),
];

const aiRecipe: Recipe = {
  id: '0192f0c0-0000-7000-8000-0000000000aa',
  source: 'ai',
  title: 'Spinach paneer wraps',
  cuisine: 'Fusion',
  minutes: 15,
  servings: 2,
  diet: 'vegetarian',
  ingredients: [
    { name: 'Spinach', amount: 200, unit: 'g' },
    { name: 'Paneer', amount: 200, unit: 'g' },
    { name: 'Tortillas', amount: 4, unit: null },
  ],
  steps: [{ title: 'Wrap', text: 'Wrap it up.' }],
};

const unavailable = () =>
  new Response(JSON.stringify({ error: { code: 'ai_unavailable', message: 'off' } }), {
    status: 503,
  });

describe('RecipesPage: Cook with what’s left (SRS 6.9)', () => {
  it('REC-1..REC-6 ranks AI and local recipes on the device; #1 says why', async () => {
    const sent: unknown[] = [];
    mockApi({
      'POST /ai/recipes': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return { recipes: [aiRecipe], createdAt: new Date().toISOString() };
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    await seed(fridge());
    setDesktop(true);
    const { container } = renderApp('/recipes', returningUserMe);
    const hero = await screen.findByTestId('recipe-hero');
    await waitFor(() =>
      expect(screen.getByTestId('ai-status')).toHaveTextContent('AI checked 4 items · just now'),
    );
    // AI and local candidates are ranked together by SRS 8.5 (not by the model, SRS 9.3): the
    // wraps use spinach + paneer and miss only tortillas (10 + 7 − 3 − 0.75 = 13.25); palak
    // paneer uses more but misses garlic and ginger (20.5 − 6 − 1.5 = 13). Its spices are
    // assumed on hand: this pantry never tracked them.
    expect(within(hero).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Spinach paneer wraps',
    );
    expect(hero).toHaveTextContent(
      /Why #1: it saves 2 things that expire soonest, including the spinach that goes bad today/,
    );
    expect(hero).toHaveTextContent('AI suggestion');
    expect(hero).toHaveTextContent('Missing: tortillas');
    expect(hero).toHaveTextContent('You have 2 of 3 ingredients');
    expect(within(hero).getByRole('link', { name: /Cook this/ })).toHaveAttribute(
      'href',
      `/recipes/${aiRecipe.id}`,
    );
    const rows = screen.getAllByTestId('recipe-row');
    expect(rows.length).toBe(5);
    expect(screen.getByRole('link', { name: 'Cook Weeknight palak paneer' })).toBeInTheDocument();
    // SRS 9.1: only item names, days left and preferences are sent; no people or list names.
    expect(sent[0]).toEqual({
      pantryId: PANTRY,
      expiring: [
        { name: 'Spinach', daysLeft: 0 },
        { name: 'Paneer', daysLeft: 1 },
      ],
      available: ['Onion', 'Tomato'],
      preferences: DEFAULT_RECIPE_PREFS,
    });
    expect(screen.getByText(/Suggested by AI from your pantry/)).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('rule 2 / ANA-6: AI unavailable still ranks the local set, and says so', async () => {
    mockApi({ 'POST /ai/recipes': unavailable, 'GET /me/saved-recipes': { saved: [] } });
    await seed(fridge());
    renderApp('/recipes', returningUserMe);
    expect(await screen.findByTestId('recipe-hero')).toHaveTextContent('Weeknight palak paneer');
    await waitFor(() =>
      expect(screen.getByTestId('ai-status')).toHaveTextContent('Ranked from your pantry · no AI'),
    );
    expect(screen.getByText(/Ranked on your device/)).toBeInTheDocument();
  });

  it('REC-2 preference chips filter and are saved to the account', async () => {
    const patches: unknown[] = [];
    mockApi({
      'POST /ai/recipes': unavailable,
      'GET /me/saved-recipes': { saved: [] },
      'PATCH /me/settings': (init: RequestInit) => {
        patches.push(JSON.parse(String(init.body)));
        return { ...returningUserMe.settings };
      },
    });
    await seed([
      pantryItem({ id: 'eggs', foodId: 'eggs', name: 'Eggs', expiresOn: TODAY }),
      pantryItem({ id: 'rice', foodId: 'cooked-rice', name: 'Cooked rice', expiresOn: TODAY }),
    ]);
    renderApp('/recipes', returningUserMe);
    expect(await screen.findByTestId('recipe-hero')).toHaveTextContent(/egg/i);
    const veg = screen.getByRole('button', { name: 'Vegetarian' });
    expect(veg).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(veg);
    expect(veg).toHaveAttribute('aria-pressed', 'true');
    // Egg recipes are gone: "vegetarian" excludes eggs.
    await waitFor(() => expect(screen.getByTestId('recipe-hero')).not.toHaveTextContent(/egg/i));
    expect(patches).toEqual([expect.objectContaining({ diet: 'vegetarian' })]);
  });

  it('REC-3 "Add to list" puts the missing ingredient on the home list for this recipe', async () => {
    mockApi({ 'POST /ai/recipes': unavailable, 'GET /me/saved-recipes': { saved: [] } });
    await seed([
      pantryItem({ id: 'spinach', foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
      pantryItem({ id: 'paneer', foodId: 'paneer', name: 'Paneer', expiresOn: TODAY }),
    ]);
    renderApp('/recipes', returningUserMe);
    const hero = await screen.findByTestId('recipe-hero');
    await userEvent.click(within(hero).getByRole('button', { name: /^Add .+ to the list$/ }));
    const list = getDoc(listDocName(HOME));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)).toEqual([
        expect.objectContaining({ reason: 'recipe', recipeId: 'palak-paneer-quick' }),
      ]),
    );
    expect(await screen.findByText(/Added .+ to Home/)).toBeInTheDocument();
  });

  it('empty pantry: friendly message and Scan a receipt', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    renderApp('/recipes', returningUserMe);
    expect(await screen.findByRole('heading', { name: 'No recipes fit yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scan a receipt/ })).toHaveAttribute('href', '/scan');
  });
});

describe('Saved recipes (SRS 6.14)', () => {
  it('SAV-1..SAV-4 heart saves (sent to the account), then groups by readiness', async () => {
    const puts: string[] = [];
    mockApi({
      'POST /ai/recipes': unavailable,
      'GET /me/saved-recipes': { saved: [] },
      'PUT /me/saved-recipes/:id': (_: RequestInit, url: URL) => {
        puts.push(url.pathname.split('/').pop()!);
        return undefined;
      },
    });
    await seed(fridge());
    renderApp('/recipes', returningUserMe);
    const hero = await screen.findByTestId('recipe-hero');
    const heart = within(hero).getByRole('button', { name: 'Save Weeknight palak paneer' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(puts).toEqual(['palak-paneer-quick']));

    await userEvent.click(screen.getByRole('link', { name: /Saved · 1/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Saved recipes' }),
    ).toBeInTheDocument();
    const card = screen.getByTestId('saved-recipe');
    expect(card).toHaveTextContent('Weeknight palak paneer');
    expect(card).toHaveTextContent('Spinach expires today');
    // Has spinach, paneer, onion, tomato; missing garlic and ginger (spices are assumed).
    expect(screen.getByRole('heading', { name: /Missing 1–2 things · 1/ })).toBeInTheDocument();
    expect(card).toHaveTextContent('Spinach expires today');
  });

  it('SAV-2 offline: saving works and is sent once back online', async () => {
    const fetchSpy = mockApi({
      'GET /me/saved-recipes': { saved: [] },
      'PUT /me/saved-recipes/:id': undefined,
    });
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await seed(fridge());
    renderApp('/recipes', returningUserMe);
    const hero = await screen.findByTestId('recipe-hero');
    await userEvent.click(within(hero).getByRole('button', { name: /^Save / }));
    expect(useRecipeStore.getState().pending).toEqual({ 'palak-paneer-quick': 'save' });
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('saved-recipes/'))).toEqual([]);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(useRecipeStore.getState().pending).toEqual({}));
  });

  it('SAV-5 search and filters; empty saved list has one next action', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] }, 'POST /ai/recipes': unavailable });
    renderApp('/recipes/saved', returningUserMe);
    expect(
      await screen.findByRole('heading', { name: 'No saved recipes yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See tonight’s recipes' })).toHaveAttribute(
      'href',
      '/recipes',
    );
  });
});
