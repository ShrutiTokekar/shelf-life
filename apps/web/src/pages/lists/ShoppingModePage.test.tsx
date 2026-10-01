import { addListItem, readListItems } from '@shelf-life/docs';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { seededMe } from '../../test/fixtures';
import { HOME_LIST, listItem } from '../../test/listFixtures';
import { renderApp } from '../../test/renderApp';

describe('ShoppingModePage (LST-9)', () => {
  it('big rows without app nav, keeps the screen on, and Done shopping', async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) });
    Object.assign(navigator, { wakeLock: { request } });
    const handle = getDoc(listDocName(HOME_LIST));
    await handle.ready;
    addListItem(handle.doc, listItem({ name: 'Eggs' }));
    addListItem(handle.doc, listItem({ name: 'Atta' }));
    const { container } = renderApp(`/lists/${HOME_LIST}/shop`, seededMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shopping: Apartment 4B' }),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('screen');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(screen.getByText('2 left')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Eggs' }));
    expect(screen.getByText('1 left')).toBeInTheDocument();
    expect(readListItems(handle.doc).find((i) => i.name === 'Eggs')!.checked).toBe(true);
    const footer = screen.getByRole('button', { name: 'Done shopping' });
    expect(within(footer).getByText('Done shopping')).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });
});
