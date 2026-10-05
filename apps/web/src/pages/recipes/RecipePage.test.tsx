import { addItems, readActivity, readItem, readListItems } from '@shelf-life/docs';
import { addDays, todayIso, type PantryItem, type Recipe } from '@shelf-life/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { useRecipeStore } from '../../stores/recipes';
import { useTimers } from '../../stores/timers';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
  resetMedia();
  useTimers.setState({ timers: {} });
});

const TODAY = todayIso();
async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
  return handle.doc;
}
const fridge = () => [
  pantryItem({ id: 'spin', foodId: 'spinach', name: 'Spinach', expiresOn: TODAY, unit: 'bag' }),
  pantryItem({
    id: 'pan',
    foodId: 'paneer',
    name: 'Paneer',
    expiresOn: addDays(TODAY, 3),
    quantity: 400,
    unit: 'g',
  }),
];

describe('RecipePage (SRS 6.15)', () => {
  it('RCP-1..RCP-3 RCP-5 header, have/missing ingredients, illustrated steps with timers', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    await seed(fridge());
    const { container } = renderApp('/recipes/palak-paneer-quick', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Weeknight palak paneer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Saves 2 things before they go bad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Weeknight palak paneer' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('ingredient');
    expect(rows[0]).toHaveTextContent('300 g Spinach');
    expect(rows[0]).toHaveTextContent('Expires today');
    expect(rows[1]).toHaveTextContent('You have it');
    const onion = rows.find((r) => r.textContent?.includes('Onion'))!;
    expect(onion).toHaveTextContent('Missing');
    expect(rows.find((r) => r.textContent?.includes('Salt'))).toHaveTextContent('Kitchen basic');
    expect(rows.find((r) => r.textContent?.includes('Cumin'))).toHaveTextContent(
      'Spice or condiment · assumed on hand',
    );
    // RCP-5: every step has an illustration (decorative) and a timer where timing matters.
    const steps = screen.getAllByTestId('step');
    expect(steps).toHaveLength(5);
    expect(steps[0]!.querySelector('[data-scene]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(steps[0]!).getByRole('button', { name: 'Start 1:00 timer' })).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);

    await userEvent.click(within(onion).getByRole('button', { name: 'Add Onion to the list' }));
    const list = getDoc(listDocName(returningUserMe.pantry!.homeListId));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)[0]).toMatchObject({ name: 'Onion', reason: 'recipe' }),
    );
  });

  it('RCP-3 SRS 8.10 the servings stepper rescales amounts to kitchen-friendly values', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    await seed(fridge());
    renderApp('/recipes/palak-paneer-quick', returningUserMe);
    const servings = await screen.findByRole('group', { name: 'Servings: 3' });
    await userEvent.click(within(servings).getByRole('button', { name: 'More servings' }));
    expect(screen.getByRole('group', { name: 'Servings: 4' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('ingredient');
    expect(rows[0]).toHaveTextContent('400 g Spinach');
    expect(rows.find((r) => r.textContent?.includes('Garam masala'))).toHaveTextContent(
      '⅔ tsp (3 ml) Garam masala',
    );
    expect(screen.getByText(/scaled for 4 servings/)).toBeInTheDocument();
    expect(screen.getByText('Serves 4')).toBeInTheDocument();
  });

  it('RCP-5 a step timer counts down, keeps time, and alerts when done', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    renderApp('/recipes/palak-paneer-quick', returningUserMe);
    const step = (await screen.findAllByTestId('step'))[0]!;
    await userEvent.click(within(step).getByRole('button', { name: 'Start 1:00 timer' }));
    expect(
      within(step).getByRole('button', { name: /^Pause timer for Wilt the spinach, 1:00 left$/ }),
    ).toBeInTheDocument();
    // A minute passes (the phone may even have been asleep): the timer stores when it ends.
    act(() => {
      const t = useTimers.getState().timers['palak-paneer-quick:0']!;
      useTimers.setState({ timers: { [t.id]: { ...t, endsAt: Date.now() - 1 } } });
    });
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Timer done');
    expect(vibrate).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss timer' }));
    expect(useTimers.getState().timers).toEqual({});
  });

  it('RCP-10 "I made this" updates the pantry, runs out what’s finished, records it', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    const doc = await seed(fridge());
    setDesktop(true);
    renderApp('/recipes/palak-paneer-quick', returningUserMe);
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'I made this' })).find(
        (b) => b.checkVisibility?.() ?? true,
      )!,
    );
    const sheet = await screen.findByRole('dialog', { name: 'Nice! What did you use?' });
    // 1 bag of spinach for 300 g: units don't match, so it guesses "used it all".
    const spinach = within(sheet).getByRole('group', { name: /Spinach/ });
    expect(within(spinach).getByRole('radio', { name: 'Used it all' })).toBeChecked();
    // 400 g paneer, recipe uses 200 g: some left, 200 pre-filled.
    const paneer = within(sheet).getByRole('group', { name: /Paneer/ });
    expect(within(paneer).getByRole('radio', { name: 'Some left' })).toBeChecked();
    expect(within(paneer).getByRole('textbox', { name: 'How much is left?' })).toHaveValue('200');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save to pantry' }));

    expect(readItem(doc, 'spin')).toMatchObject({ status: 'out', outAt: TODAY });
    expect(readItem(doc, 'pan')).toMatchObject({ status: 'active', quantity: 200 });
    const activity = readActivity(doc);
    expect(activity.find((a) => a.type === 'cooked')).toMatchObject({
      recipeId: 'palak-paneer-quick',
      subject: 'Weeknight palak paneer',
      actorId: returningUserMe.user.id,
    });
    expect(activity.filter((a) => a.type === 'used')).toHaveLength(2);
    expect(activity.filter((a) => a.type === 'ran_out').map((a) => a.itemId)).toEqual(['spin']);
    expect(
      await screen.findByText(/you made Weeknight palak paneer\. 1 item ran out/),
    ).toBeVisible();

    // Undo puts it all back.
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(readItem(doc, 'spin')).toMatchObject({ status: 'active' });
    expect(readItem(doc, 'pan')).toMatchObject({ quantity: 400 });
    expect(readActivity(doc)).toEqual([]);
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
    expect(screen.getAllByRole('link', { name: 'Back to recipes' })[0]).toHaveAttribute(
      'href',
      '/recipes',
    );
  });
});
