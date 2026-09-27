import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { renderWithRouter } from '../../test/render';
import { NavHeader, type NavHeaderProps } from './NavHeader';

const base: NavHeaderProps = {
  active: 'today',
  listHref: '/lists/abc',
  userName: 'Shruti',
  userInitial: 'S',
  textSize: 'default',
  onTextSizeChange: () => undefined,
  highContrast: false,
  onHighContrastChange: () => undefined,
};

describe('NavHeader', () => {
  it('SRS 5.1 has the wordmark, four tabs and the tools', () => {
    renderWithRouter(<NavHeader {...base} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Shelf Life' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Today', 'Pantry', 'Grocery list', 'Recipes']);
    expect(screen.getByRole('radiogroup', { name: 'Text size' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High contrast' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reminders' })).toHaveAttribute('href', '/reminders');
    expect(screen.getByRole('link', { name: 'Upload receipt' })).toHaveAttribute('href', '/scan');
    expect(screen.getByRole('link', { name: 'Account, Shruti' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('marks the active tab with aria-current', () => {
    renderWithRouter(<NavHeader {...base} active="recipes" />);
    expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
  });

  it('SRS 7 badges are announced with the parent label', () => {
    renderWithRouter(<NavHeader {...base} listCount={4} remindersCount={2} />);
    expect(screen.getByRole('link', { name: 'Grocery list, 4 items to buy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reminders, 2 unread' })).toBeInTheDocument();
  });

  it('A11Y-7 high contrast is a toggle button with aria-pressed', async () => {
    const onHighContrastChange = vi.fn();
    renderWithRouter(<NavHeader {...base} onHighContrastChange={onHighContrastChange} />);
    const toggle = screen.getByRole('button', { name: 'High contrast' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(onHighContrastChange).toHaveBeenCalledWith(true);
  });

  it('A11Y-4 tab order runs wordmark → tabs → tools', async () => {
    renderWithRouter(<NavHeader {...base} />);
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      const el = document.activeElement as HTMLElement;
      order.push(el.getAttribute('aria-label') ?? el.textContent ?? '');
    }
    expect(order).toEqual([
      'Shelf Life',
      'Today',
      'Pantry',
      'Grocery list',
      'Recipes',
      'Default text size',
      'High contrast',
      'Reminders',
      'Upload receipt',
      'Account, Shruti',
    ]);
  });

  it('has no serious axe violations', async () => {
    const { container } = renderWithRouter(<NavHeader {...base} listCount={3} />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
