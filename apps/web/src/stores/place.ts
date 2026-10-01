import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Place = {
  /** The pantry being viewed, when the user can see more than one (SHR-6). */
  pantryId: string | null;
  /** The grocery list last opened, so the List tab reopens it. */
  listId: string | null;
  setPantry: (id: string) => void;
  setList: (id: string) => void;
};

const safeLocalStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

/** Where the user was: kept on this device only, as a convenience. */
export const usePlace = create<Place>()(
  persist(
    (set) => ({
      pantryId: null,
      listId: null,
      setPantry: (pantryId) => set({ pantryId }),
      setList: (listId) => set({ listId }),
    }),
    { name: 'shelf-life:place', storage: safeLocalStorage },
  ),
);
