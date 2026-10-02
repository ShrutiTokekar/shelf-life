import {
  addItems,
  addListItem,
  applyReview,
  readItem,
  readItems,
  readListItems,
  readTodayState,
} from '@shelf-life/docs';
import {
  addDays,
  DEFAULT_RECIPE_PREFS,
  newListItem,
  todayIso,
  type PantryItem,
} from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY, savedReceipt, scanDraft } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => resetMedia());

const TODAY = todayIso();
const HOME = returningUserMe.pantry!.homeListId;

async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
  return handle.doc;
}

const spinach = () => pantryItem({ id: 'spinach', name: 'Spinach', expiresOn: TODAY, quantity: 1 });
const eggs = () =>
  pantryItem({ id: 'eggs', name: 'Eggs', status: 'out', quantity: 0, outAt: TODAY });
const yogurt = () => pantryItem({ id: 'yogurt', name: 'Yogurt', expiresOn: addDays(TODAY, 2) });
const cilantro = () =>
  pantryItem({ id: 'cilantro', name: 'Cilantro', expiresOn: addDays(TODAY, 2) });
const rice = () => pantryItem({ id: 'rice', name: 'Rice', expiresOn: addDays(TODAY, 120) });

describe('TodayPage (SRS 6.2, Figma 02)', () => {
  it('TOD-9 a brand-new pantry prompts the first scan', async () => {
    renderApp('/', returningUserMe);
    expect(
      await screen.findByRole('heading', { name: 'Your shelves are empty' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan your first receipt' })).toHaveAttribute(
      'href',
      '/scan',
    );
  });

  it('TOD-9 nothing urgent: says so, with Scan receipt and the timeline', async () => {
    await seed([rice()]);
    renderApp('/', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nothing urgent today' }),
    ).toBeInTheDocument();
    const priorities = screen.getByRole('region', { name: 'Today’s priorities' });
    expect(within(priorities).getByRole('link', { name: 'Scan receipt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your shelf life' })).toBeInTheDocument();
  });

  it('TOD-1 TOD-3 TOD-4 TOD-5 three ranked priorities with progress', async () => {
    await seed([spinach(), eggs(), yogurt(), cilantro(), rice()]);
    const { container } = renderApp('/', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: '3 things need you today' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/· Home$/)).toBeInTheDocument();
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument();
    const cards = screen.getAllByTestId('priority');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 2 }).textContent)).toEqual([
      '1. Use your spinach today',
      '2. Buy eggs',
      '3. Plan for cilantro and yogurt',
    ]);
    expect(cards[0]).toHaveTextContent('Expires today');
    expect(cards[1]).toHaveTextContent('You used the last of it today. Nobody’s getting it yet.');
    expect(cards[2]).toHaveTextContent(/Both expire by \w+day\./);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('"Used it" completes #1, updates progress, and Undo brings it back', async () => {
    const doc = await seed([spinach(), eggs()]);
    renderApp('/', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Used it: Spinach' }));
    // The last spinach is gone, so it's now "ran out" and becomes a new priority.
    expect(await screen.findByText('1 of 3 done')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Buy spinach/ })).toBeInTheDocument();
    expect(readItem(doc, 'spinach')!.status).not.toBe('active');
    expect(readTodayState(doc, 'u1', TODAY).done).toEqual(['expires:spinach']);
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(readTodayState(doc, 'u1', TODAY).done).toEqual([]));
    expect(readItem(doc, 'spinach')!.status).toBe('active');
  });

  it('"Add & claim" puts a ran-out item on its list with your name', async () => {
    await seed([eggs()]);
    renderApp('/', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Add & claim' }));
    const list = getDoc(listDocName(HOME));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)).toEqual([
        expect.objectContaining({ name: 'Eggs', claimedBy: 'u1', pantryItemId: 'eggs' }),
      ]),
    );
    expect(await screen.findByText('1 of 1 done')).toBeInTheDocument();
  });

  it('"Snooze a day" moves #1 down; "Remind me" hides the plan until its day', async () => {
    const doc = await seed([spinach(), eggs(), yogurt()]);
    renderApp('/', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Snooze a day' }));
    await waitFor(() => expect(screen.getAllByTestId('priority')[0]).toHaveTextContent('Buy eggs'));
    expect(readTodayState(doc, 'u1', TODAY).snoozed['expires:spinach']).toBe(addDays(TODAY, 1));
    await userEvent.click(screen.getByRole('button', { name: /^Remind me / }));
    await waitFor(() => expect(screen.getAllByTestId('priority')).toHaveLength(2));
    expect(await screen.findByText(/We’ll bring this back/)).toBeInTheDocument();
  });

  it('a receipt that needs review is a priority with a Review link', async () => {
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    const r = savedReceipt({ storeName: 'Trader Joe’s' }, scanDraft(undefined, 0.55));
    applyReview(handle.doc, r);
    renderApp('/', returningUserMe);
    const card = (await screen.findAllByTestId('priority')).find((c) =>
      c.textContent!.includes('Check your Trader Joe’s receipt'),
    )!;
    expect(within(card).getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      `/scan/review?receipt=${r.receipt.id}`,
    );
  });

  it('TOD-6 timeline chips open the item sheet', async () => {
    await seed([spinach(), rice()]);
    renderApp('/', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Rice 4 mo' }));
    expect(await screen.findByRole('dialog', { name: /Edit Rice/ })).toBeInTheDocument();
  });

  it('TOD-10 mobile top bar: text size cycles', async () => {
    renderApp('/', returningUserMe);
    const button = await screen.findByRole('button', { name: /^Text size: Default text size/ });
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: /^Text size: Large text size/ })).toBeInTheDocument();
  });
});

describe('TodayPage desktop (web 11)', () => {
  it('TOD-8 shows the grocery list preview and "Since yesterday"', async () => {
    setDesktop(true);
    const doc = await seed([spinach()]);
    const { recordActivity } = await import('@shelf-life/docs');
    recordActivity(doc, [
      {
        id: 'a1',
        pantryId: PANTRY,
        listId: HOME,
        actorId: 'u2',
        type: 'ran_out',
        subject: 'Eggs',
        itemId: 'eggs',
        beforeExpiry: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    renderApp('/', seededMe);
    const feed = await screen.findByRole('region', { name: 'Since yesterday' });
    expect(feed).toHaveTextContent('Arjun used the last eggs');
    expect(screen.getByRole('region', { name: /Grocery list · 0 to buy/ })).toHaveTextContent(
      'Nothing to buy.',
    );
  });

  it('6c the expiring card offers the top recipe that uses it; "Used it" stays as an option', async () => {
    await seed([
      pantryItem({ id: 'spin', foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
      pantryItem({ id: 'pan', foodId: 'paneer', name: 'Paneer', expiresOn: addDays(TODAY, 1) }),
    ]);
    renderApp('/', returningUserMe);
    const make = await screen.findByRole('link', { name: /^Make .+, uses your Spinach$/ });
    expect(make.getAttribute('href')).toMatch(/^\/recipes\//);
    expect(screen.getByRole('button', { name: 'Used it: Spinach' })).toBeInTheDocument();
  });

  it('SRS 8.4 score 70: an unclaimed list item for tonight’s top recipe becomes a priority', async () => {
    await seed([
      pantryItem({ id: 'spin', foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
      pantryItem({ id: 'pan', foodId: 'paneer', name: 'Paneer', expiresOn: TODAY }),
    ]);
    // Find tonight's top recipe the same way the page does, then put one of its needs on the list.
    const { rankRecipes } = await import('@shelf-life/ranking');
    const { LOCAL_RECIPES } = await import('@shelf-life/shared/recipes');
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    const top = rankRecipes({
      recipes: LOCAL_RECIPES,
      pantry: [...readItems(handle.doc)],
      listItems: [],
      today: TODAY,
      prefs: DEFAULT_RECIPE_PREFS,
    })[0]!;
    const need = top.missing[0]!.ingredient.name;
    const list = getDoc(listDocName(HOME));
    await list.ready;
    addListItem(list.doc, {
      ...newListItem(
        { name: need, quantity: null, unit: '' },
        { listId: HOME, userId: 'u2', now: '' },
      ),
      reason: 'recipe',
      recipeId: top.recipe.id,
    });
    renderApp('/', returningUserMe);
    const card = await screen.findByRole('article', {
      name: new RegExp(`Get ${need.toLowerCase()} for tonight`),
    });
    await userEvent.click(within(card).getByRole('button', { name: 'I’ll get it' }));
    await waitFor(() => expect(readListItems(list.doc)[0]!.claimedBy).toBe('u1'));
  });
});
