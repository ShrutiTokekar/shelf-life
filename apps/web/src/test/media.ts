/** Stub `matchMedia` so `useMediaQuery(DESKTOP_QUERY)` returns `desktop`. Undo with `resetMedia`. */
export function setDesktop(desktop: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: desktop && q.includes('min-width: 1024px'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

export function resetMedia() {
  // @ts-expect-error jsdom has no matchMedia; remove the stub
  delete window.matchMedia;
}
