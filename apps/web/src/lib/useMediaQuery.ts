import { useCallback, useSyncExternalStore } from 'react';

/** Live `matchMedia` result, e.g. `useMediaQuery('(min-width: 1024px)')`. False when unsupported. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;
  return useSyncExternalStore(subscribe, get, () => false);
}

/** The desktop layout starts at 1024 px (SRS 5.1). */
export const DESKTOP_QUERY = '(min-width: 1024px)';
