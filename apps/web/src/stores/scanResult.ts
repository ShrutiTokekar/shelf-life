import type { ParsedReceipt } from '@shelf-life/shared';
import { create } from 'zustand';

/**
 * The last scan's text results, kept in memory only until the review screen (Milestone 4) saves
 * them. Never persisted: closing the tab drops it. Holds text lines only, never the photo (SEC-5).
 */
type ScanResultState = {
  result: ParsedReceipt | null;
  set: (result: ParsedReceipt) => void;
  clear: () => void;
};

export const useScanResult = create<ScanResultState>()((set) => ({
  result: null,
  set: (result) => set({ result }),
  clear: () => set({ result: null }),
}));
