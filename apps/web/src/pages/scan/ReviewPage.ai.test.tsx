import { draftFromParsed, parseReceipt } from '@shelf-life/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewDraft } from '../../stores/reviewDraft';
import { returningUserMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { HOME } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  useReviewDraft.getState().clear();
  vi.restoreAllMocks();
});

/** Two lines the dictionary can't read and one it can. */
function blurryScan() {
  const text = 'PATEL BROTHERS\nTOOR DAL 4LB 8.99\nZZPN WHL 3.00\nXQ YZK 2.00';
  const parsed = parseReceipt(
    text.split('\n').map((t) => ({ text: t, confidence: 0.6 })),
    '2026-09-28',
  );
  useReviewDraft.getState().set(draftFromParsed(parsed, HOME));
}

describe('ReviewPage AI cleanup (SRS 9.2, REV-4)', () => {
  it(
    'online: unclear lines get an AI guess to confirm, an AI shelf life for unknown items, and a privacy note',
    { timeout: 20_000 },
    async () => {
      const sent: unknown[] = [];
      mockApi({
        'POST /ai/cleanup-lines': (init: RequestInit) => {
          sent.push(JSON.parse(String(init.body)));
          return {
            lines: [
              {
                raw: 'ZZPN WHL 3.00',
                name: 'Whole milk',
                category: 'dairy_eggs',
                location: 'fridge',
                confidence: 0.9,
              },
              {
                raw: 'XQ YZK 2.00',
                name: 'Yuzu kosho',
                category: 'spices_oils',
                location: 'fridge',
                confidence: 0.6,
              },
            ],
          };
        },
        'POST /ai/shelf-life': { days: 60, basis: 'Paste, refrigerated' },
      });
      blurryScan();
      // StrictMode, as in development: React mounts twice; AI must still apply, and be asked once.
      renderApp('/scan/review', returningUserMe, { strict: true });
      expect(
        await screen.findByRole('checkbox', { name: 'Add Milk to pantry' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /AI guess from “ZZPN WHL”\. Tap to confirm\./ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'Add Yuzu kosho to pantry' }),
      ).toBeInTheDocument();
      // Not in the dictionary, so AI estimated its shelf life (60 days from the purchase date).
      await waitFor(() =>
        expect(
          useReviewDraft.getState().draft!.items.find((i) => i.name === 'Yuzu kosho'),
        ).toMatchObject({ expirySource: 'ai', expiresOn: '2026-11-27' }),
      );
      expect(screen.getByText(/never your photo/)).toBeInTheDocument();
      // Only the unclear lines and the store were sent: no photo, no people.
      expect(sent).toEqual([
        {
          pantryId: returningUserMe.pantry!.id,
          lines: ['ZZPN WHL 3.00', 'XQ YZK 2.00'],
          store: 'Patel Brothers',
        },
      ]);
    },
  );

  it('rule 2: when AI is unavailable the lines keep the plain "not sure" note', async () => {
    mockApi({
      'POST /ai/cleanup-lines': () =>
        new Response(JSON.stringify({ error: { code: 'ai_unavailable', message: 'off' } }), {
          status: 503,
        }),
    });
    blurryScan();
    renderApp('/scan/review', returningUserMe);
    await waitFor(() => expect(useReviewDraft.getState().draft?.aiChecked).toBe(true));
    await waitFor(() => expect(useReviewDraft.getState().aiPending).toBe(0));
    expect(screen.getAllByRole('button', { name: /We’re not sure about/ })).toHaveLength(2);
    expect(screen.queryByText(/never your photo/)).toBeNull();
  });

  it('offline: AI isn’t asked at all', async () => {
    const fetchSpy = mockApi({});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    blurryScan();
    renderApp('/scan/review', returningUserMe);
    await screen.findAllByRole('button', { name: /We’re not sure about/ });
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/ai/'))).toEqual([]);
  });
});
