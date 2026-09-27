import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

afterEach(() => vi.restoreAllMocks());

describe('OfflineBanner', () => {
  it('SRS 6 shows "Offline, changes will sync" in a live region when the device goes offline', () => {
    render(<OfflineBanner />);
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    act(() => setOnline(false));
    expect(region).toHaveTextContent('Offline, changes will sync');
    act(() => setOnline(true));
    expect(region).toBeEmptyDOMElement();
  });

  it('can be forced on (sync disconnected)', () => {
    render(<OfflineBanner forceShow />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline, changes will sync');
  });
});
