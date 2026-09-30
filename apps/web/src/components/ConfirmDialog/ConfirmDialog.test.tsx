import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete this receipt?"
      body="Items stay in your pantry."
      confirmLabel="Delete receipt"
      cancelLabel="Keep it"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('is an alertdialog that starts on the safe choice', async () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this receipt?' });
    expect(dialog).toHaveAccessibleDescription('Items stay in your pantry.');
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('confirms, cancels, and Escape cancels', async () => {
    const { onConfirm, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Delete receipt' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
