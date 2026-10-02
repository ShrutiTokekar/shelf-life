import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell, type RouteHandle } from './components/AppShell/AppShell';
import { RequireAuth } from './components/RequireAuth/RequireAuth';
import { JoinPage } from './pages/join/JoinPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { PageSkeleton } from './components/Skeleton/Skeleton';
import { PlaceholderPage } from './pages/placeholder/PlaceholderPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { TodayPage } from './pages/today/TodayPage';
import { WelcomePage } from './pages/welcome/WelcomePage';

// Pantry, Review and Receipts pull in Yjs, IndexedDB and Radix dialogs; Scan pulls in the OCR
// pipeline. Load them only when opened (PERF-2).
const PantryPage = lazy(() =>
  import('./pages/pantry/PantryPage').then((m) => ({ default: m.PantryPage })),
);
const ScanPage = lazy(() => import('./pages/scan/ScanPage').then((m) => ({ default: m.ScanPage })));
const ReviewPage = lazy(() =>
  import('./pages/scan/ReviewPage').then((m) => ({ default: m.ReviewPage })),
);
const ListPage = lazy(() =>
  import('./pages/lists/ListPage').then((m) => ({ default: m.ListPage })),
);
const NewListPage = lazy(() =>
  import('./pages/lists/NewListPage').then((m) => ({ default: m.NewListPage })),
);
const ShoppingModePage = lazy(() =>
  import('./pages/lists/ShoppingModePage').then((m) => ({ default: m.ShoppingModePage })),
);
const RecipesPage = lazy(() =>
  import('./pages/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);
const AnalyzePage = lazy(() =>
  import('./pages/recipes/AnalyzePage').then((m) => ({ default: m.AnalyzePage })),
);
const RecipePage = lazy(() =>
  import('./pages/recipes/RecipePage').then((m) => ({ default: m.RecipePage })),
);
const CookPage = lazy(() =>
  import('./pages/recipes/CookPage').then((m) => ({ default: m.CookPage })),
);
const ReceiptsPage = lazy(() =>
  import('./pages/receipts/ReceiptsPage').then((m) => ({ default: m.ReceiptsPage })),
);

const placeholder = (path: string, titleKey: string): RouteObject => ({
  path,
  element: <PlaceholderPage titleKey={titleKey} />,
});

/** Routes from SRS 5.2. Pages not built yet render a placeholder with the right h1. */
export const routes: RouteObject[] = [
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/join/:token', element: <JoinPage /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth allowWithoutPantry>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    // Full-screen scanner (Figma 04 has no app nav).
    path: '/scan',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <ScanPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    // RCP-7 cook-along is full screen (Figma 16 has no app nav).
    path: '/recipes/:id/cook',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <CookPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    // LST-9 shopping mode is full screen: no app nav.
    path: '/lists/:listId/shop',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <ShoppingModePage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    // Full-screen like the scanner it follows (Figma 05 has no app nav); sticky footer (REV-6).
    path: '/scan/review',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <ReviewPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <TodayPage />,
        handle: {
          skipLink: { targetId: 'priorities', textKey: 'skip.today' },
        } satisfies RouteHandle,
      },
      {
        path: 'pantry',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <PantryPage />
          </Suspense>
        ),
        handle: { skipLink: { targetId: 'shelves', textKey: 'skip.pantry' } } satisfies RouteHandle,
      },
      // SRS 5.2: the list page also serves the switcher (/lists), share dialog and add sheet.
      ...['lists', 'lists/:listId', 'lists/:listId/share', 'lists/:listId/add'].map(
        (path): RouteObject => ({
          path,
          element: (
            <Suspense fallback={<PageSkeleton />}>
              <ListPage />
            </Suspense>
          ),
          handle: {
            skipLink: { targetId: 'list-items', textKey: 'skip.list' },
          } satisfies RouteHandle,
        }),
      ),
      {
        path: 'lists/new',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <NewListPage />
          </Suspense>
        ),
      },
      // SRS 6.9 + 6.14: one page, two tabs.
      ...['recipes', 'recipes/saved', 'recipes/history'].map((path): RouteObject => ({
        path,
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <RecipesPage />
          </Suspense>
        ),
        handle: {
          skipLink: { targetId: 'recipes-ranked', textKey: 'skip.recipes' },
        } satisfies RouteHandle,
      })),
      {
        path: 'recipes/analyze',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <AnalyzePage />
          </Suspense>
        ),
      },
      {
        path: 'recipes/:id',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <RecipePage />
          </Suspense>
        ),
        handle: {
          skipLink: { targetId: 'recipe-steps', textKey: 'skip.recipe' },
        } satisfies RouteHandle,
      },
      placeholder('reminders', 'pages.reminders'),
      { path: 'profile', element: <ProfilePage /> },
      {
        // One page for the list and a receipt: mobile shows one at a time, desktop both (web 16).
        path: 'profile/receipts/:id?',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ReceiptsPage />
          </Suspense>
        ),
        handle: {
          skipLink: { targetId: 'receipts', textKey: 'skip.receipts' },
        } satisfies RouteHandle,
      },
      placeholder('*', 'pages.notFound'),
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
