import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

describe('AppShell', () => {
  it('A11Y-5 has landmarks and exactly one h1', async () => {
    const { container } = renderApp('/', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SRS 5.1 the skip link is the first focusable element and uses the page text', async () => {
    renderApp('/', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    await userEvent.tab();
    expect(document.activeElement).toHaveTextContent("Skip to today's priorities");
  });

  it('other pages fall back to "Skip to main content"', async () => {
    renderApp('/reminders', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Reminders' });
    await userEvent.tab();
    expect(document.activeElement).toHaveTextContent('Skip to main content');
  });

  it('List nav points at the home list', async () => {
    renderApp('/', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    const homeList = returningUserMe.pantry!.homeListId;
    expect(screen.getByRole('link', { name: 'Grocery list' })).toHaveAttribute(
      'href',
      `/lists/${homeList}`,
    );
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute(
      'href',
      `/lists/${homeList}`,
    );
  });
});
