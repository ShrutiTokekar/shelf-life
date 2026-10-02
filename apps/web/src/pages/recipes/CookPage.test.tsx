import { addItems, recordActivity } from '@shelf-life/docs';
import { todayIso } from '@shelf-life/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { useCookSession } from '../../stores/cookSession';
import { useUiSettings } from '../../stores/uiSettings';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { setDesktop, resetMedia } from '../../test/media';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
  resetMedia();
  useUiSettings.setState({ textSize: 'default' });
});

describe('CookPage: cook-along (RCP-7)', () => {
  it('one step per screen with progress, Back / Next, focus on the new step, and the screen kept on', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    const request = vi.fn(async () => ({ release: vi.fn(async () => undefined) }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { container } = renderApp('/recipes/egg-fried-rice-leftover-veg/cook', returningUserMe);
    const h1 = await screen.findByRole('heading', { level: 1, name: /Prep everything first/ });
    await waitFor(() => expect(h1).toHaveFocus());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Step 1 of 5 · Fridge-clearing egg fried rice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(request).toHaveBeenCalledWith('screen');
    // No app nav (full screen, Figma 16).
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(await seriousViolations(container)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: /Next step/ }));
    const two = await screen.findByRole('heading', { level: 1, name: /Scramble the eggs/ });
    await waitFor(() => expect(two).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Start 1:00 timer' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Prep everything first/ }),
    ).toBeInTheDocument();
  });

  it('the last step finishes into "All done" with I made this; Aa cycles the text size', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    renderApp('/recipes/egg-fried-rice-leftover-veg/cook?step=5', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: /Finish/ });
    await userEvent.click(screen.getByRole('button', { name: /^Finish$/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'All done!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I made this' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Text size: Default/ }));
    expect(useUiSettings.getState().textSize).toBe('large');
  });

  it('uses the servings chosen on the recipe page for "I made this"', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    addItems(handle.doc, [
      pantryItem({ id: 'eggs', foodId: 'eggs', name: 'Eggs', quantity: 12, unit: '' }),
    ]);
    useCookSession.getState().setServings('egg-fried-rice-leftover-veg', 4);
    renderApp('/recipes/egg-fried-rice-leftover-veg/cook?step=6', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'I made this' }));
    // 2 eggs for 2 servings → 4 for 4: 8 left.
    expect(await screen.findByRole('textbox', { name: 'How much is left?' })).toHaveValue('8');
  });
});

describe('Recipes → History (SAV-1, web)', () => {
  it('lists recipes I cooked, newest first, with how often', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] }, 'POST /ai/recipes': undefined });
    setDesktop(true);
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    const cooked = (id: string, recipeId: string, createdAt: string, actorId = 'u1') => ({
      id,
      pantryId: PANTRY,
      listId: returningUserMe.pantry!.homeListId,
      actorId,
      type: 'cooked' as const,
      subject: recipeId,
      itemId: null,
      beforeExpiry: null,
      recipeId,
      createdAt,
    });
    recordActivity(handle.doc, [
      cooked('a', 'masala-omelette', `${todayIso()}T08:00:00.000Z`),
      cooked('b', 'toor-dal-tadka', `${todayIso()}T19:00:00.000Z`),
      cooked('c', 'masala-omelette', `${todayIso()}T09:00:00.000Z`),
      cooked('d', 'mujadara', `${todayIso()}T20:00:00.000Z`, 'someone-else'),
    ]);
    renderApp('/recipes/history', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cooking history' }),
    ).toBeInTheDocument();
    const rows = await screen.findAllByTestId('cooked-recipe');
    expect(rows.map((r) => r.querySelector('h2')!.textContent)).toEqual([
      'Everyday dal tadka',
      'Masala omelette',
    ]);
    expect(rows[1]).toHaveTextContent('Cooked 2 times');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
  });
});
