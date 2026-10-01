import type {
  CleanupLinesInput,
  CleanupLinesResult,
  ShelfLifeInput,
  ShelfLifeResult,
} from '@shelf-life/shared';

/**
 * SRS 9.1: every AI feature goes through this interface, so the model can be swapped (Gemini
 * today, maybe an in-browser model later) without touching the app. Milestone 6c adds
 * suggestRecipes; 7 adds suggestSwap and chat.
 */
export type AiProvider = {
  name: string;
  cleanupLines(input: Omit<CleanupLinesInput, 'pantryId'>): Promise<CleanupLinesResult>;
  estimateShelfLife(input: Omit<ShelfLifeInput, 'pantryId'>): Promise<ShelfLifeResult>;
};

/** AI is off, failed twice, or answered with something that doesn't fit the schema. */
export class AiUnavailableError extends Error {}
