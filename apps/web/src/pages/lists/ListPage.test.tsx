import { addListItem, readListItems, readListMeta } from '@shelf-life/docs';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { seededMe } from '../../test/fixtures';
import { HOME_LIST, listItem } from '../../test/listFixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  resetMedia();
  vi.restoreAllMocks();
});

async function seedList(items = [listItem()]) {
  const handle = getDoc(listDocName(HOME_LIST));
  await handle.ready;
  for (const i of items) addListItem(handle.doc, i);
  return handle.doc;
}

const today = new Date().toISOString();

describe('ListPage mobile (SRS 6.6, Figma 06)', () => {
  it('LST-1 title, switcher, counts; empty state', async () => {
    const { container } = renderApp(`/lists/${HOME_LIST}`, seededMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Grocery list' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apartment 4B, switch lists' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByText(/0 to buy · 0 in cart/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nothing on this list' })).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('LST-2 the add field adds several items at once, with Undo', async () => {
    const doc = await seedList([]);
    renderApp(`/lists/${HOME_LIST}`, seededMe);
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Add to the list' }),
      '2 onions and eggs',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(readListItems(doc).map((i) => [i.name, i.quantity, i.addedBy])).toEqual([
      ['Onions', 2, 'u1'],
      ['Eggs', null, 'u1'],
    ]);
    expect(await screen.findByText('Added 2 items: Onions, Eggs')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(readListItems(doc)).toEqual([]);
  });

  it('LST-3 groups by priority; LST-5 claims with Undo; LST-7 checking moves to the cart', async () => {
    const doc = await seedList([
      listItem({ id: 'eggs', reason: 'ran_out', createdAt: today }),
      listItem({
        id: 'atta',
        name: 'Atta',
        quantity: 20,
        unit: 'lb',
        addedBy: 'u1',
        claimedBy: 'u3',
      }),
    ]);
    renderApp(`/lists/${HOME_LIST}`, seededMe);
    const needed = await screen.findByRole('region', { name: /Needed today/ });
    expect(within(needed).getByRole('checkbox', { name: 'Eggs' })).toBeInTheDocument();
    expect(within(needed).getByText(/Ran out today · added by arjun/i)).toBeInTheDocument();
    const week = screen.getByRole('region', { name: /This week/ });
    expect(within(week).getByText('Meera Shah is getting it')).toBeInTheDocument();

    await userEvent.click(within(needed).getByRole('button', { name: 'I’ll get it: Eggs' }));
    expect(readListItems(doc).find((i) => i.id === 'eggs')!.claimedBy).toBe('u1');
    expect(await screen.findByText('You’re getting Eggs')).toBeInTheDocument();

    await userEvent.click(within(week).getByRole('checkbox', { name: 'Atta' }));
    const cart = await screen.findByRole('region', { name: /In the cart · 1/ });
    expect(within(cart).getByRole('checkbox', { name: 'Atta' })).toBeChecked();
    expect(screen.getByText(/1 to buy · 1 in cart/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done shopping' }));
    expect(readListMeta(doc).doneShoppingBy).toBe('u1');
  });

  it('SHR-8 people who left show as "Former member"', async () => {
    await seedList([listItem({ addedBy: 'gone', claimedBy: 'gone' })]);
    renderApp(`/lists/${HOME_LIST}`, seededMe);
    expect(await screen.findByText('Former member is getting it')).toBeInTheDocument();
  });

  it('SHR-5 "Can view" members see the list but cannot add, check or claim', async () => {
    await seedList();
    const viewOnly = {
      ...seededMe,
      lists: seededMe.lists.map((l, i) => (i === 0 ? { ...l, role: 'view' as const } : l)),
    };
    renderApp(`/lists/${HOME_LIST}`, viewOnly);
    expect(await screen.findByText(/You can view this list/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add to the list' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /I’ll get it/ })).toBeNull();
  });

  it('SHR-1 the switcher sheet lists every list with its label and a New shared list link', async () => {
    renderApp('/lists', seededMe);
    const sheet = await screen.findByRole('dialog', { name: 'Your lists' });
    const links = within(sheet).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Apartment 4B'),
      expect.stringContaining('Family groceries'),
      expect.stringContaining('Diwali party'),
      expect.stringContaining('New shared list'),
    ]);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(within(sheet).getByText('Pantry label: Family groceries')).toBeInTheDocument();
  });

  it('ADD opens the add sheet from the empty add field and adds with a claimer', async () => {
    const doc = await seedList([]);
    const { router } = renderApp(`/lists/${HOME_LIST}`, seededMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Add' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/lists/${HOME_LIST}/add`));
    const sheet = await screen.findByRole('dialog', { name: 'Add to grocery list' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Item' }), 'Oat milk');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Arjun' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add to shared list' }));
    expect(readListItems(doc)[0]).toMatchObject({ name: 'Oat milk', claimedBy: 'u2' });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/lists/${HOME_LIST}`));
  });

  it('shows "List not found" for a list you are not on', async () => {
    renderApp('/lists/0192f0c0-0000-7000-8000-0000000000ff', seededMe);
    expect(await screen.findByRole('heading', { name: 'List not found' })).toBeInTheDocument();
  });
});

describe('ListPage desktop (web 14)', () => {
  it('LST-8 LST-11 tabs, who is getting what, and the cart panel', async () => {
    setDesktop(true);
    await seedList([
      listItem({ name: 'Onions', claimedBy: 'u2' }),
      listItem({ name: 'Eggs' }),
      listItem({ name: 'Tomatoes', checked: true, checkedBy: 'u1', checkedAt: today }),
    ]);
    const { container } = renderApp(`/lists/${HOME_LIST}`, seededMe);
    const tabs = await screen.findByRole('navigation', { name: 'Your lists' });
    expect(within(tabs).getByRole('link', { name: /Apartment 4B/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: /New list/ })).toHaveAttribute(
      'href',
      '/lists/new',
    );
    const who = screen.getByRole('region', { name: 'Who’s getting what' });
    expect(who).toHaveTextContent('ArjunOnions');
    expect(who).toHaveTextContent('UnclaimedEggs');
    expect(screen.getByRole('region', { name: /In the cart · 1/ })).toHaveTextContent('by you');
    expect(screen.getByRole('link', { name: 'Start shopping mode' })).toHaveAttribute(
      'href',
      `/lists/${HOME_LIST}/shop`,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
