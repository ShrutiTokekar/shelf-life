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

// Pantry pulls in Yjs, IndexedDB and Radix dialogs; Scan pulls in the OCR pipeline. Load them only
// when opened (PERF-2).
const PantryPage = lazy(() =>
  import('./pages/pantry/PantryPage').then((m) => ({ default: m.PantryPage })),
);
const ScanPage = lazy(() => import('./pages/scan/ScanPage').then((m) => ({ default: m.ScanPage })));
const ReviewPreviewPage = lazy(() =>
  import('./pages/scan/ReviewPreviewPage').then((m) => ({ default: m.ReviewPreviewPage })),
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
      {
        path: 'scan/review',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ReviewPreviewPage />
          </Suspense>
        ),
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
      placeholder('profile/receipts', 'pages.receipts'),
      placeholder('profile/receipts/:id', 'pages.receipt'),
      placeholder('*', 'pages.notFound'),
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
