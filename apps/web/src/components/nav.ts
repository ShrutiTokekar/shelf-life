export type NavKey = 'today' | 'pantry' | 'list' | 'recipes' | 'none';

/** Which nav item a path belongs to (SRS 5.1, 5.2). */
export function navKeyForPath(pathname: string): NavKey {
  if (pathname === '/') return 'today';
  if (pathname.startsWith('/pantry')) return 'pantry';
  if (pathname.startsWith('/lists')) return 'list';
  if (pathname.startsWith('/recipes')) return 'recipes';
  return 'none';
}
