import type {
  AiRecipesResult,
  ChatInput,
  ChatMessage,
  ChatReply,
  SwapInput,
  SwapResult,
  CleanupLinesInput,
  RecipesInput,
  CleanupLinesResult,
  ShelfLifeItem,
  ShelfLivesResult,
} from '@shelf-life/shared';

/**
 * SRS 9.1: every AI feature goes through this interface, so the model can be swapped (Gemini
 * today, maybe an in-browser model later) without touching the app.
 */
export type AiProvider = {
  name: string;
  cleanupLines(input: Omit<CleanupLinesInput, 'pantryId'>): Promise<CleanupLinesResult>;
  /** One call for several items; answers in the same order. */
  estimateShelfLives(input: { items: ShelfLifeItem[] }): Promise<ShelfLivesResult>;
  /** Up to 8 recipes for what's expiring (SRS 9.2). Ranking happens in the app, not here. */
  suggestRecipes(input: Omit<RecipesInput, 'pantryId'>): Promise<AiRecipesResult>;
  /** RCP-4: something from the pantry that can stand in for a missing ingredient. */
  suggestSwap(input: Omit<SwapInput, 'pantryId'>): Promise<SwapResult>;
  /** RCP-8: answer one message about the recipe, with the last messages for context. */
  chat(
    input: Omit<ChatInput, 'pantryId' | 'threadId'> & { history: ChatMessage[] },
  ): Promise<ChatReply>;
};

/** AI is off, failed twice, or answered with something that doesn't fit the schema. */
export class AiUnavailableError extends Error {}
