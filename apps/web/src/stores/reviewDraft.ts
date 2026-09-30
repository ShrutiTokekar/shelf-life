import type { ReviewDraft } from '@shelf-life/shared';
import { create } from 'zustand';

/**
 * The review screen's working copy (SRS 6.5), kept in memory only until it's saved: closing the
 * tab drops an unsaved scan. Holds text lines only, never the photo (SEC-5).
 */
type ReviewDraftState = {
  draft: ReviewDraft | null;
  set: (draft: ReviewDraft) => void;
  update: (fn: (draft: ReviewDraft) => ReviewDraft) => void;
  clear: () => void;
};

export const useReviewDraft = create<ReviewDraftState>()((set) => ({
  draft: null,
  set: (draft) => set({ draft }),
  update: (fn) => set((s) => (s.draft ? { draft: fn(s.draft) } : s)),
  clear: () => set({ draft: null }),
}));

/** Router state Pantry reads to highlight the jars a review just added, for 3 s (REV-7). */
export type PantryHighlightState = { highlight: string[] };
