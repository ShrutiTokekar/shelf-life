import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast({ message: 'Spinach moved to Ran out.', action: { label: 'Undo', onAction: onUndo } })
      }
    >
      go
    </button>
  );
}

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('SRS 7 is announced in a status region and disappears after 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger onUndo={() => undefined} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('status')).toHaveTextContent('Spinach moved to Ran out.');
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByRole('status')).toHaveTextContent('Spinach');
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('PAN-8 Undo runs the action and closes the toast', async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('SRS 7 pauses while focused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger onUndo={() => undefined} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole('status')).toHaveTextContent('Spinach');
  });
});
