import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { Button } from './Button';

describe('Button', () => {
  it('A11Y-3 has a 44 px minimum height class for every size', () => {
    render(
      <>
        <Button>Save</Button>
        <Button size="sm">Upload</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('min-h-[3.25rem]');
    expect(screen.getByRole('button', { name: 'Upload' }).className).toContain('min-h-[2.875rem]');
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('A11Y-4 is reachable and clickable with the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('loading keeps its label for screen readers, sets aria-busy and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Continue with Google
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Continue with Google' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders each variant with token classes only', () => {
    render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="secondary">S</Button>
        <Button variant="ghost">G</Button>
        <Button variant="danger">D</Button>
      </>,
    );
    expect(screen.getByText('P').closest('button')!.className).toContain('bg-navy');
    expect(screen.getByText('S').closest('button')!.className).toContain('border-navy');
    expect(screen.getByText('D').closest('button')!.className).toContain('bg-terra-dark');
    for (const b of screen.getAllByRole('button'))
      expect(b.className).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('asChild renders a link with button styles', () => {
    render(
      <Button asChild>
        <a href="/scan">Scan</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Scan' });
    expect(link.className).toContain('bg-navy');
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<Button fullWidth>Create</Button>);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
