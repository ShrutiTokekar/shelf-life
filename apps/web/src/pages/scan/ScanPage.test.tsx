import type { ParsedReceipt } from '@shelf-life/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ScanSession from '../../features/ocr/scanSession';
import { ScanError } from '../../features/ocr/scanSession';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

const runScan = vi.fn();
vi.mock('../../features/ocr/scanSession', async (orig) => ({
  ...(await orig<typeof ScanSession>()),
  runScan: (...a: unknown[]) => runScan(...a),
}));

function setDesktop(desktop: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: desktop && q.includes('1024'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

const photo = () => new File([new Uint8Array(10)], 'r.jpg', { type: 'image/jpeg' });
const receipt: ParsedReceipt = {
  store: 'Patel Brothers',
  receiptDate: null,
  purchasedOn: '2026-09-28',
  lineCount: 3,
  items: [],
  skipped: [],
};

beforeEach(() => {
  runScan.mockReset();
});
afterEach(() => {
  // @ts-expect-error reset the stub
  delete window.matchMedia;
});

describe('ScanPage desktop (SCN-2)', () => {
  beforeEach(() => setDesktop(true));

  it('shows the upload drop zone and lock note', async () => {
    const { container } = renderApp('/scan', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Upload a receipt' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument();
    expect(screen.getByText('Processed on this device. Nothing is uploaded.')).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('a finished scan goes to review', async () => {
    runScan.mockResolvedValue(receipt);
    const { router } = renderApp('/scan', returningUserMe);
    await userEvent.upload(await screen.findByTestId('file-input'), photo());
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/scan/review'));
  });

  it('SCN-2 rejects the wrong file type with an alert', async () => {
    renderApp('/scan', returningUserMe);
    await userEvent.upload(
      await screen.findByTestId('file-input'),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or HEIC photo.');
    expect(runScan).not.toHaveBeenCalled();
  });

  it('SCN-7 unreadable → Retake and Add manually', async () => {
    runScan.mockImplementation(async () => {
      throw new ScanError('unreadable', "We couldn't read this receipt");
    });
    renderApp('/scan', returningUserMe);
    await userEvent.upload(await screen.findByTestId('file-input'), photo());
    expect(
      await screen.findByRole('heading', { name: "We couldn't read this receipt" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add manually' })).toHaveAttribute(
      'href',
      '/pantry?add=1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retake' }));
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument();
  });

  it('SCN-4 Cancel returns to the drop zone with a toast', async () => {
    runScan.mockImplementation((...args: unknown[]) => {
      const opts = args[1] as { signal: AbortSignal };
      return new Promise((_, reject) =>
        opts.signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
      );
    });
    renderApp('/scan', returningUserMe);
    await userEvent.upload(await screen.findByTestId('file-input'), photo());
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Scan cancelled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument();
  });

  it('other failures show a retry', async () => {
    runScan.mockImplementation(async () => {
      throw new Error('boom');
    });
    renderApp('/scan', returningUserMe);
    await userEvent.upload(await screen.findByTestId('file-input'), photo());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong reading the photo',
    );
  });
});

describe('ScanPage mobile (SCN-1)', () => {
  beforeEach(() => setDesktop(false));

  it('A11Y-8 without a camera: explains, disables the shutter, keeps upload', async () => {
    const { container } = renderApp('/scan', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Scan receipt' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('No camera here. Upload a photo of your receipt instead.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Close scanner' })).toHaveAttribute('href', '/');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
