import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { newUserMe, returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

function mockCreate(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('OnboardingPage (home list setup)', () => {
  it('WEL-4 name defaults to "Home" and a color is preselected', async () => {
    renderApp('/onboarding', newUserMe);
    expect(await screen.findByRole('textbox', { name: 'List name' })).toHaveValue('Home');
    expect(screen.getByRole('radio', { name: 'Navy' })).toHaveAttribute('aria-checked', 'true');
  });

  it('WEL-4 Create posts the list and lands on Today', async () => {
    const fetchSpy = mockCreate(201, { ...returningUserMe.lists[0] });
    const { router } = renderApp('/onboarding', [newUserMe, returningUserMe]);
    const name = await screen.findByRole('textbox', { name: 'List name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Apartment 4B');
    await userEvent.click(screen.getByRole('radio', { name: 'Olive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create home list' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/lists',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string)).toEqual({
      name: 'Apartment 4B',
      color: 'olive',
      isPrivate: false,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('WEL-4 an empty name shows an inline error linked to the field, without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderApp('/onboarding', newUserMe);
    const name = await screen.findByRole('textbox', { name: 'List name' });
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Create home list' }));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/Give your list a name/);
    expect(name).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a 409 (home list already exists) still continues to Today', async () => {
    mockCreate(409, { error: { code: 'conflict', message: 'exists' } });
    renderApp('/onboarding', [newUserMe, returningUserMe]);
    await userEvent.click(await screen.findByRole('button', { name: 'Create home list' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('shows a plain-language error when creating fails', async () => {
    mockCreate(500, { error: { code: 'internal_error', message: 'boom' } });
    renderApp('/onboarding', newUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Create home list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t create your list');
    expect(screen.getByRole('button', { name: 'Create home list' })).toBeEnabled();
  });

  it('has no serious axe violations', async () => {
    const { container } = renderApp('/onboarding', newUserMe);
    await screen.findByRole('textbox', { name: 'List name' });
    expect(await seriousViolations(container)).toEqual([]);
  });
});
