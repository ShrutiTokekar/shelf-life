import type {
  CleanupLinesInput,
  CleanupLinesResult,
  ShelfLifeItem,
  ShelfLivesResult,
} from '@shelf-life/shared';

/**
 * SRS 9.1: every AI feature goes through this interface, so the model can be swapped (Gemini
 * today, maybe an in-browser model later) without touching the app. Milestone 6c adds
 * suggestRecipes; 7 adds suggestSwap and chat.
 */
export type AiProvider = {
  name: string;
  cleanupLines(input: Omit<CleanupLinesInput, 'pantryId'>): Promise<CleanupLinesResult>;
  /** One call for several items; answers in the same order. */
  estimateShelfLives(input: { items: ShelfLifeItem[] }): Promise<ShelfLivesResult>;
};

/** AI is off, failed twice, or answered with something that doesn't fit the schema. */
export class AiUnavailableError extends Error {}
