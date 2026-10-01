import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

function Harness() {
  const [v, setV] = useState(1);
  return <QuantityStepper label="Quantity" name="Oat milk" value={v} onChange={setV} />;
}

describe('QuantityStepper (ADD-2)', () => {
  it('steps within bounds with named buttons', async () => {
    render(<Harness />);
    const less = screen.getByRole('button', { name: 'Less Oat milk' });
    expect(less).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'More Oat milk' }));
    expect(screen.getByRole('group', { name: 'Quantity: 2' })).toBeInTheDocument();
    await userEvent.click(less);
    expect(screen.getByRole('group', { name: 'Quantity: 1' })).toBeInTheDocument();
  });
});
