import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell, type RouteHandle } from './components/AppShell/AppShell';
import { RequireAuth } from './components/RequireAuth/RequireAuth';
import { JoinPage } from './pages/join/JoinPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { PlaceholderPage } from './pages/placeholder/PlaceholderPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { TodayPage } from './pages/today/TodayPage';
import { WelcomePage } from './pages/welcome/WelcomePage';

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
      placeholder('pantry', 'pages.pantry'),
      placeholder('scan', 'pages.scan'),
      placeholder('scan/review', 'pages.reviewScan'),
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
