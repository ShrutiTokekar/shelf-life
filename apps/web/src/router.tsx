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
      placeholder('lists', 'pages.lists'),
      placeholder('lists/new', 'pages.newList'),
      placeholder('lists/:listId', 'pages.list'),
      placeholder('lists/:listId/share', 'pages.shareList'),
      placeholder('lists/:listId/add', 'pages.addItem'),
      placeholder('lists/:listId/shop', 'pages.shop'),
      placeholder('recipes', 'pages.recipes'),
      placeholder('recipes/analyze', 'pages.analyze'),
      placeholder('recipes/saved', 'pages.savedRecipes'),
      placeholder('recipes/:id', 'pages.recipe'),
      placeholder('recipes/:id/cook', 'pages.cook'),
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
