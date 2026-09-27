import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/render';
import { seriousViolations } from '../../test/axe';
import { NavBottom } from './NavBottom';

describe('NavBottom', () => {
  it('SRS 5.1 shows Today, Pantry, Scan, List, Recipes in order', () => {
    renderWithRouter(<NavBottom active="today" listHref="/lists/abc" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const names = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent || l.getAttribute('aria-label'));
    expect(names).toEqual(['Today', 'Pantry', 'Scan receipt', 'List', 'Recipes']);
  });

  it('SRS 7 marks the active item with aria-current="page"', () => {
    renderWithRouter(<NavBottom active="pantry" listHref="/lists/abc" />);
    expect(screen.getByRole('link', { name: 'Pantry' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('active: none marks nothing', () => {
    renderWithRouter(<NavBottom active="none" listHref="/lists/abc" />);
    expect(screen.queryAllByRole('link').filter((l) => l.getAttribute('aria-current'))).toEqual([]);
  });

  it('List goes to the home list and announces the unchecked count', () => {
    renderWithRouter(<NavBottom active="today" listHref="/lists/abc" listCount={4} />);
    const list = screen.getByRole('link', { name: 'List, 4 items to buy' });
    expect(list).toHaveAttribute('href', '/lists/abc');
  });

  it('Scan is an icon-only link with a label', () => {
    renderWithRouter(<NavBottom active="today" listHref="/lists/abc" />);
    expect(screen.getByRole('link', { name: 'Scan receipt' })).toHaveAttribute('href', '/scan');
  });

  it('has no serious axe violations', async () => {
    const { container } = renderWithRouter(
      <NavBottom active="list" listHref="/lists/abc" listCount={2} />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
