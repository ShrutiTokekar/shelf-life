import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { SearchField } from './SearchField';

afterEach(() => vi.useRealTimers());

describe('SearchField', () => {
  it('SRS 7 has a label and debounces search by 150 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearch = vi.fn();
    render(<SearchField label="Search pantry" clearLabel="Clear search" onSearch={onSearch} />);
    const input = screen.getByRole('searchbox', { name: 'Search pantry' });
    onSearch.mockClear();
    await userEvent.type(input, 'yog');
    act(() => vi.advanceTimersByTime(100));
    expect(onSearch).not.toHaveBeenCalledWith('yog');
    act(() => vi.advanceTimersByTime(60));
    expect(onSearch).toHaveBeenLastCalledWith('yog');
  });

  it('clear button empties the field, searches immediately and returns focus', async () => {
    const onSearch = vi.fn();
    render(<SearchField label="Search pantry" clearLabel="Clear search" onSearch={onSearch} />);
    const input = screen.getByRole('searchbox', { name: 'Search pantry' });
    await userEvent.type(input, 'milk');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(onSearch).toHaveBeenLastCalledWith('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('hideLabel keeps the accessible name', async () => {
    const { container } = render(
      <SearchField label="Search pantry" clearLabel="Clear" hideLabel onSearch={() => undefined} />,
    );
    expect(screen.getByRole('searchbox', { name: 'Search pantry' })).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });
});
