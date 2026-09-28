import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { CameraView } from './CameraView';

describe('CameraView', () => {
  it('shows a message while the camera is not live', () => {
    render(
      <CameraView
        videoRef={createRef()}
        live={false}
        scanning={false}
        placeholder="Starting the camera…"
      />,
    );
    expect(screen.getByText('Starting the camera…')).toBeInTheDocument();
  });

  it('A11Y-8 keeps a live region for "Receipt found"', () => {
    render(<CameraView videoRef={createRef()} live scanning={false} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('SCN-5 shows the scan-line sweep only while reading (CSS hides it for Reduce motion)', () => {
    const { rerender } = render(<CameraView videoRef={createRef()} live scanning={false} />);
    expect(screen.queryByTestId('scan-line')).toBeNull();
    rerender(<CameraView videoRef={createRef()} live scanning />);
    expect(screen.getByTestId('scan-line')).toHaveClass('scan-line');
  });

  it('has no serious axe violations', async () => {
    const { container } = render(
      <CameraView videoRef={createRef()} live={false} scanning={false} placeholder="Starting" />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
