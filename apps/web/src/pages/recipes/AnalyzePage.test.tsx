import { addItems } from '@shelf-life/docs';
import { addDays, todayIso, type PantryItem } from '@shelf-life/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { useUiSettings } from '../../stores/uiSettings';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
  useUiSettings.setState({ reduceMotion: false });
});

const TODAY = todayIso();
async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
}
const kitchen = () => [
  pantryItem({ foodId: 'spinach', name: 'Spinach', expiresOn: TODAY }),
  pantryItem({ foodId: 'greek-yogurt', name: 'Greek yogurt', expiresOn: addDays(TODAY, 2) }),
  ...[
    'Eggs',
    'Tomatoes',
    'Pasta',
    'Garlic',
    'Rice',
    'Whole milk',
    'Tortillas',
    'Butter',
    'Oats',
  ].map((name) => pantryItem({ name, expiresOn: addDays(TODAY, 30) })),
  pantryItem({ name: 'Onions', status: 'out', quantity: 0, outAt: TODAY }),
];

describe('AnalyzePage: AI pantry analysis (SRS 6.8)', () => {
  it('ANA-1..ANA-5 runs the four steps, shows what’s expiring, then See N recipes', async () => {
    useUiSettings.setState({ reduceMotion: true });
    const ai = vi.fn(() => ({ recipes: [], createdAt: new Date().toISOString() }));
    mockApi({ 'POST /ai/recipes': ai, 'GET /me/saved-recipes': { saved: [] } });
    await seed(kitchen());
    const { container } = renderApp('/recipes/analyze', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Checking what’s left' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/AI is looking at all 11 items in Home/)).toBeInTheDocument();
    const see = await screen.findByRole('button', { name: /^See \d+ recipes?$/ });
    await waitFor(() => expect(see).toBeEnabled());
    expect(ai).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Ranked and ready')).toBeInTheDocument();
    expect(screen.getByText('Spinach')).toBeInTheDocument();
    expect(screen.getByText('+ 2 more')).toBeInTheDocument();
    expect(screen.getByText(/Out of onions\./)).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
    await userEvent.click(see);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cook with what’s left' }),
    ).toBeInTheDocument();
  });

  it('ANA-6 offline: skips AI and says the results are ranked on the device', async () => {
    useUiSettings.setState({ reduceMotion: true });
    const fetchSpy = mockApi({});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await seed(kitchen());
    renderApp('/recipes/analyze', returningUserMe);
    expect(await screen.findByText(/You’re offline, so these are ranked/)).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/ai/'))).toEqual([]);
  });
});
