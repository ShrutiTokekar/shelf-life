import type {
  ChatAction,
  ChatMessage,
  RecipeIngredient,
  RecipeStep,
  SwapResult,
} from '@shelf-life/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Swap = { from: string; to: string; amount: string };

/** RCP-8 "Update recipe": the AI's version, written for `servings`. */
export type RecipeUpdate = {
  summary: string;
  servings: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
};

export type ChatEntry = ChatMessage & {
  /** Actions already applied from this message (their buttons show "Done"). */
  applied?: number[];
};

/**
 * This cooking session's changes to a recipe (SRS 8.10, RCP-4, RCP-8): servings, swaps, an AI
 * update, and the chat. Kept while the tab is open so the recipe page and cook-along agree;
 * never saved to the account (the chat thread itself is kept 30 days on the API).
 */
type CookSession = {
  servings: Record<string, number>;
  swaps: Record<string, Swap[]>;
  updates: Record<string, RecipeUpdate>;
  chats: Record<string, { threadId: string | null; messages: ChatEntry[] }>;
  /** RCP-4 answers by `${recipeId}|${missing}` (null = no swap), so AI is asked once. */
  swapAnswers: Record<string, SwapResult | null>;
  setSwapAnswer: (key: string, answer: SwapResult | null) => void;
  setServings: (recipeId: string, servings: number) => void;
  addSwap: (recipeId: string, swap: Swap) => void;
  setUpdate: (recipeId: string, update: RecipeUpdate) => void;
  /** Back to the recipe as written (servings kept). */
  resetChanges: (recipeId: string) => void;
  appendChat: (recipeId: string, messages: ChatEntry[], threadId?: string) => void;
  markApplied: (recipeId: string, messageIndex: number, actionIndex: number) => void;
};

const safeSessionStorage = createJSONStorage(() => {
  try {
    return window.sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

const without = <T>(rec: Record<string, T>, key: string) => {
  const next = { ...rec };
  delete next[key];
  return next;
};

export const useCookSession = create<CookSession>()(
  persist(
    (set, get) => ({
      servings: {},
      swaps: {},
      updates: {},
      chats: {},
      swapAnswers: {},
      setSwapAnswer: (key, answer) => set({ swapAnswers: { ...get().swapAnswers, [key]: answer } }),
      setServings: (recipeId, servings) =>
        set({ servings: { ...get().servings, [recipeId]: servings } }),
      addSwap: (recipeId, swap) => {
        const list = (get().swaps[recipeId] ?? []).filter(
          (s) => s.from.toLowerCase() !== swap.from.toLowerCase(),
        );
        set({ swaps: { ...get().swaps, [recipeId]: [...list, swap] } });
      },
      setUpdate: (recipeId, update) => set({ updates: { ...get().updates, [recipeId]: update } }),
      resetChanges: (recipeId) =>
        set({ swaps: without(get().swaps, recipeId), updates: without(get().updates, recipeId) }),
      appendChat: (recipeId, messages, threadId) => {
        const chat = get().chats[recipeId] ?? { threadId: null, messages: [] };
        set({
          chats: {
            ...get().chats,
            [recipeId]: {
              threadId: threadId ?? chat.threadId,
              messages: [...chat.messages, ...messages],
            },
          },
        });
      },
      markApplied: (recipeId, messageIndex, actionIndex) => {
        const chat = get().chats[recipeId];
        if (!chat) return;
        const messages = chat.messages.map((m, i) =>
          i === messageIndex ? { ...m, applied: [...(m.applied ?? []), actionIndex] } : m,
        );
        set({ chats: { ...get().chats, [recipeId]: { ...chat, messages } } });
      },
    }),
    { name: 'shelf-life:cook-session', storage: safeSessionStorage },
  ),
);

export type { ChatAction };
