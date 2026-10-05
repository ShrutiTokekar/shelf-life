import { addItems, readListItems } from '@shelf-life/docs';
import { addDays, todayIso, type PantryItem } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { resetMedia } from '../../test/media';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
  resetMedia();
});

const TODAY = todayIso();
async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
}
const kitchen = () => [
  pantryItem({ foodId: 'tortillas', name: 'Tortillas', expiresOn: addDays(TODAY, 2) }),
  pantryItem({ foodId: 'paneer', name: 'Paneer', expiresOn: addDays(TODAY, 3) }),
  pantryItem({ foodId: 'bell-pepper', name: 'Bell pepper', expiresOn: TODAY }),
];
const unavailable = () =>
  new Response(JSON.stringify({ error: { code: 'ai_unavailable', message: 'off' } }), {
    status: 503,
  });

describe('RCP-4 swap card', () => {
  it('suggests a pantry swap for the first missing item; Use it swaps it in for this session', async () => {
    const sent: { missing: string; pantry: string[] }[] = [];
    mockApi({
      'GET /me/saved-recipes': { saved: [] },
      'POST /ai/chat': unavailable,
      'POST /ai/swap': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return {
          swap: 'Paneer',
          amount: '100 g, grated',
          note: 'It melts less.',
          adjustments: 'Cook 1 minute longer per side.',
        };
      },
    });
    await seed(kitchen());
    const { container } = renderApp('/recipes/black-bean-quesadillas', returningUserMe);
    const card = await screen.findByRole('complementary', { name: 'AI swap suggestion' });
    expect(card).toHaveTextContent('No cheddar, grated? Use your paneer');
    expect(card).toHaveTextContent('Cook 1 minute longer per side.');
    expect(sent[0]).toMatchObject({ missing: 'Cheddar, grated' });
    expect(sent[0]!.pantry.sort()).toEqual(['Bell pepper', 'Paneer', 'Tortillas']);
    expect(await seriousViolations(container)).toEqual([]);

    await userEvent.click(within(card).getByRole('button', { name: 'Use it' }));
    const row = screen
      .getAllByTestId('ingredient')
      .find((r) => r.textContent?.includes('Swapped in for cheddar'))!;
    expect(row).toHaveTextContent('100 g Paneer');
    expect(row).toHaveTextContent('You have it');
    expect(screen.getByText(/Changed for this session: paneer for cheddar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to the original' }));
    expect(screen.queryByText(/Swapped in for/)).toBeNull();
  });

  it('rule 2: without AI there is no card, just "Missing"', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] }, 'POST /ai/swap': unavailable });
    await seed(kitchen());
    renderApp('/recipes/black-bean-quesadillas', returningUserMe);
    const rows = await screen.findAllByTestId('ingredient');
    expect(rows.find((r) => r.textContent?.includes('Cheddar'))).toHaveTextContent('Missing');
    await waitFor(() => expect(screen.queryByRole('complementary', { name: /swap/ })).toBeNull());
  });
});

describe('RCP-8 recipe chat', () => {
  it('Ask AI opens the chat; a reply’s actions change servings and add to the list', async () => {
    const sent: { step: number | null; servings: number; threadId?: string | null }[] = [];
    mockApi({
      'GET /me/saved-recipes': { saved: [] },
      'POST /ai/swap': unavailable,
      'POST /ai/chat': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return {
          threadId: '0192f0c0-0000-7000-8000-0000000000cc',
          reply: 'Doubled. You’ll need more cheddar.',
          actions: [
            { type: 'updateServings', servings: 4 },
            { type: 'addToList', name: 'Cheddar' },
          ],
        };
      },
    });
    await seed(kitchen());
    renderApp('/recipes/black-bean-quesadillas', returningUserMe);
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Ask AI' })).find(Boolean)!,
    );
    const sheet = await screen.findByRole('dialog', { name: 'Ask Shelf Life AI' });
    expect(within(sheet).getByText(/Using: 3 pantry items · 2 servings/)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Make it for 4' }));
    const log = within(sheet).getByRole('log');
    expect(await within(log).findByText('Doubled. You’ll need more cheddar.')).toBeInTheDocument();
    expect(sent[0]).toMatchObject({ step: null, servings: 2, threadId: null });

    await userEvent.click(within(log).getByRole('button', { name: 'Make it for 4' }));
    expect(within(log).getByRole('button', { name: 'Make it for 4, done' })).toBeDisabled();
    await userEvent.click(within(log).getByRole('button', { name: 'Add cheddar to list' }));
    const list = getDoc(listDocName(returningUserMe.pantry!.homeListId));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)[0]).toMatchObject({ name: 'Cheddar', reason: 'recipe' }),
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: 'Servings: 4' })).toBeInTheDocument();

    // The next message continues the same thread.
    await userEvent.click(screen.getAllByRole('button', { name: 'Ask AI' })[0]!);
    const again = await screen.findByRole('dialog', { name: 'Ask Shelf Life AI' });
    await userEvent.click(within(again).getByRole('button', { name: 'Exact amounts' }));
    await waitFor(() =>
      expect(sent[1]).toMatchObject({
        servings: 4,
        threadId: '0192f0c0-0000-7000-8000-0000000000cc',
      }),
    );
  });

  it('AI unavailable: the panel says so and the recipe still works', async () => {
    mockApi({
      'GET /me/saved-recipes': { saved: [] },
      'POST /ai/swap': unavailable,
      'POST /ai/chat': unavailable,
    });
    await seed(kitchen());
    renderApp('/recipes/black-bean-quesadillas', returningUserMe);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Ask AI' }))[0]!);
    const sheet = await screen.findByRole('dialog', { name: 'Ask Shelf Life AI' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Exact amounts' }));
    expect(await within(sheet).findByRole('status')).toHaveTextContent(
      'AI help isn’t available right now. Your recipe is still here.',
    );
  });

  it('during cook-along the chat knows the current step', async () => {
    const sent: { step: number | null }[] = [];
    mockApi({
      'GET /me/saved-recipes': { saved: [] },
      'POST /ai/chat': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return {
          threadId: '0192f0c0-0000-7000-8000-0000000000dd',
          reply: 'Like this.',
          actions: [],
        };
      },
    });
    renderApp('/recipes/black-bean-quesadillas/cook?step=3', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Ask AI' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ask Shelf Life AI' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Explain step 3' }));
    await waitFor(() => expect(sent[0]).toMatchObject({ step: 3 }));
  });
});
