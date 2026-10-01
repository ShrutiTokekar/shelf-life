import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { readActivity } from '@shelf-life/docs';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

async function openPantryWithSample() {
  const utils = renderApp('/pantry', seededMe);
  await userEvent.click(await screen.findByRole('button', { name: 'Load sample pantry' }));
  await screen.findByRole('heading', { level: 2, name: /Use today/ });
  return utils;
}

const shelf = (name: RegExp) => screen.getByRole('region', { name });

describe('PantryPage', () => {
  it('PAN-1 empty state offers Add item and Scan, plus the dev sample loader', async () => {
    renderApp('/pantry', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your pantry' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 items, shelved by what to use first')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your pantry is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan a receipt' })).toHaveAttribute('href', '/scan');
  });

  it('PAN-5 PAN-6 PAN-7 shows four shelves in order with labeled jars', async () => {
    await openPantryWithSample();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 4)).toEqual([
      expect.stringMatching(/^Use today/),
      expect.stringMatching(/^Use this week/),
      expect.stringMatching(/^Good for now/),
      expect.stringMatching(/^Ran out/),
    ]);
    expect(screen.getByText('26 items, shelved by what to use first')).toBeInTheDocument();
    const paneer = screen.getByRole('article', { name: 'Paneer' });
    expect(within(paneer).getByText('Diwali party')).toBeInTheDocument();
    // Good for now shows 4 plus "+N more".
    expect(within(shelf(/Good for now/)).getAllByRole('article')).toHaveLength(4);
    expect(
      within(shelf(/Good for now/)).getByRole('button', { name: /Show all 15 items/ }),
    ).toBeInTheDocument();
  });

  it('PAN-8 "Used it" counts down countable items, with Undo', async () => {
    await openPantryWithSample();
    const tomatoes = screen.getByRole('article', { name: 'Tomatoes' });
    expect(within(tomatoes).getByText('6 · Fridge')).toBeInTheDocument();
    await userEvent.click(within(tomatoes).getByRole('button', { name: 'Used it: Tomatoes' }));
    expect(
      await within(screen.getByRole('article', { name: 'Tomatoes' })).findByText('5 · Fridge'),
    ).toBeInTheDocument();
    expect(screen.getByText('Used one Tomatoes. 5 left.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      await within(screen.getByRole('article', { name: 'Tomatoes' })).findByText('6 · Fridge'),
    ).toBeInTheDocument();
  });

  it('PAN-8 SRS 8.6 "Used it" on a measured item moves it to Ran out', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: 'Used it: Greek yogurt' }));
    await waitFor(() =>
      expect(
        within(shelf(/Ran out/)).getByRole('article', { name: 'Greek yogurt' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('Greek yogurt moved to Ran out.')).toBeInTheDocument();
  });

  it('PAN-9 ran-out jars: "Add to list" or "On the list · claimer"', async () => {
    await openPantryWithSample();
    expect(
      within(screen.getByRole('article', { name: 'Onions' })).getByText('On the list · Arjun'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Eggs to Apartment 4B' }));
    expect(
      await within(screen.getByRole('article', { name: 'Eggs' })).findByText('On the list'),
    ).toBeInTheDocument();
    expect(screen.getByText('Eggs added to Apartment 4B.')).toBeInTheDocument();
  });

  it('PAN-12 SRS 8.9 list and category filters combine, and counts follow', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: /^Diwali party/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Dairy & eggs/ }));
    const all = screen.getAllByRole('article').map((a) => a.querySelector('h3')!.textContent);
    expect(all).toEqual(['Paneer']);
    expect(screen.getByRole('button', { name: /^Diwali party/ })).toHaveAccessibleName(
      'Diwali party 1',
    );
    await userEvent.click(screen.getByRole('button', { name: /^All lists/ }));
    expect(screen.getAllByRole('article').length).toBeGreaterThan(1);
  });

  it('PAN-1 search filters by name as you type', async () => {
    await openPantryWithSample();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pantry' }), 'rice');
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('article')
          .map((a) => a.querySelector('h3')!.textContent)
          .sort(),
      ).toEqual(['Basmati rice', 'Rice']),
    );
  });

  it('shows a "no matches" state with a way out', async () => {
    await openPantryWithSample();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pantry' }), 'zzz');
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article').length).toBeGreaterThan(1);
  });

  it('PAN-2 PAN-12 sorts: Location groups, A to Z is one list', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('radio', { name: 'Location' }));
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent!.split(',')[0]),
    ).toEqual(['Fridge', 'Freezer', 'Cupboard', 'Ran out']);
    await userEvent.click(screen.getByRole('radio', { name: 'A to Z' }));
    const names = within(shelf(/A to Z/))
      .getAllByRole('article')
      .map((a) => a.querySelector('h3')!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('PAN-11 "Add item" opens the sheet and adds to the right shelf', async () => {
    renderApp('/pantry', seededMe);
    await screen.findByRole('heading', { name: 'Your pantry is empty' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Add item' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Add an item' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Mangoes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add to pantry' }));
    expect(
      await within(await screen.findByRole('region', { name: /Use this week/ })).findByRole(
        'article',
        { name: 'Mangoes' },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Mangoes added to your pantry.')).toBeInTheDocument();
  });

  it('SRS 8.3 manual adds use the dictionary, and AI for foods it doesn’t know', async () => {
    const { addDays, todayIso } = await import('@shelf-life/shared');
    const { mockApi } = await import('../../test/mockApi');
    const { readItems } = await import('@shelf-life/docs');
    const fetchSpy = mockApi({ 'POST /ai/shelf-life': { days: 40, basis: 'Paste, refrigerated' } });
    renderApp('/pantry', seededMe);
    await screen.findByRole('heading', { name: 'Your pantry is empty' });
    const add = async (name: string) => {
      await userEvent.click(screen.getAllByRole('button', { name: 'Add item' })[0]!);
      const dialog = await screen.findByRole('dialog', { name: 'Add an item' });
      await userEvent.type(within(dialog).getByLabelText('Name'), name);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add to pantry' }));
      await screen.findByRole('article', { name });
    };
    await add('Spinach');
    await add('Yuzu kosho');
    const doc = getDoc(pantryDocName(seededMe.pantry!.id)).doc;
    await waitFor(() =>
      expect(readItems(doc).find((i) => i.name === 'Yuzu kosho')).toMatchObject({
        expirySource: 'ai',
        expiresOn: addDays(todayIso(), 40),
      }),
    );
    expect(readItems(doc).find((i) => i.name === 'Spinach')).toMatchObject({
      foodId: 'spinach',
      expirySource: 'dictionary',
    });
    // Only the unknown food went to AI.
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/ai/'))).toHaveLength(1);
    fetchSpy.mockRestore();
  });

  it('PAN-8 Edit saves changes; Delete removes with Undo', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Paneer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Paneer' });
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Malai paneer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('article', { name: 'Malai paneer' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Malai paneer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete item' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Malai paneer' })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('article', { name: 'Malai paneer' })).toBeInTheDocument();
  });

  it('SRS 12.4 items are still there after the page is reopened', async () => {
    const first = await openPantryWithSample();
    await new Promise((r) => setTimeout(r, 50));
    first.unmount();
    renderApp('/pantry', seededMe);
    expect(await screen.findByText('26 items, shelved by what to use first')).toBeInTheDocument();
  });

  it('has no serious axe violations with a full pantry', async () => {
    const { container } = await openPantryWithSample();
    expect(await seriousViolations(container)).toEqual([]);
  });
});

describe('PantryPage activity and edge cases', () => {
  const pantryId = seededMe.pantry!.id;
  const activity = () => readActivity(getDoc(pantryDocName(pantryId)).doc);

  it('SRS 8.7 "Used it" records activity; Undo removes it', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: 'Used it: Tomatoes' }));
    await waitFor(() =>
      expect(activity().map((a) => [a.type, a.subject, a.beforeExpiry])).toEqual([
        ['used', 'Tomatoes', true],
      ]),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(activity()).toEqual([]));
  });

  it('SRS 8.6 finishing an item records used + ran_out; an expired one is not "before expiry"', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: 'Used it: Coriander' }));
    await waitFor(() =>
      expect(activity().map((a) => [a.type, a.beforeExpiry])).toEqual([
        ['used', false],
        ['ran_out', null],
      ]),
    );
  });

  it('PAN-8 "Mark as ran out" from the sheet moves the jar, and Undo puts it back', async () => {
    await openPantryWithSample();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Cilantro' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as ran out' }));
    await waitFor(() =>
      expect(
        within(shelf(/Ran out/)).getByRole('article', { name: 'Cilantro' }),
      ).toBeInTheDocument(),
    );
    expect(activity().map((a) => a.type)).toEqual(['ran_out']);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(
        within(shelf(/Use this week/)).getByRole('article', { name: 'Cilantro' }),
      ).toBeInTheDocument(),
    );
    expect(activity()).toEqual([]);
  });

  it('PAN-7 a jar whose list no longer exists says "Removed list"', async () => {
    await openPantryWithSample();
    const first = screen.getByRole('article', { name: 'Paneer' });
    expect(within(first).getByText('Diwali party')).toBeInTheDocument();
    // Re-render as if Diwali party had been deleted.
    const withoutDiwali = {
      ...seededMe,
      lists: seededMe.lists.filter((l) => l.name !== 'Diwali party'),
    };
    cleanup();
    renderApp('/pantry', withoutDiwali);
    expect(
      await within(await screen.findByRole('article', { name: 'Paneer' })).findByText(
        'Removed list',
      ),
    ).toBeInTheDocument();
  });

  it('web 13 uses "e.g. yogurt" as the desktop search placeholder', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('1024'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      renderApp('/pantry', seededMe);
      expect(await screen.findByRole('searchbox', { name: 'Search pantry' })).toHaveAttribute(
        'placeholder',
        'e.g. yogurt',
      );
    } finally {
      window.matchMedia = original;
    }
  });
});
