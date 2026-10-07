import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_RECIPE_PREFS } from '@shelf-life/shared';
import type { MeResponse } from '@shelf-life/shared';

export const newUserMe: MeResponse = {
  user: {
    id: 'u1',
    email: 'ananya@example.com',
    displayName: 'Ananya Mehta',
    avatarInitial: 'A',
    createdAt: '2026-09-27T00:00:00.000Z',
  },
  pantry: null,
  lists: [],
  pantries: [],
  settings: {
    textSize: 'default',
    highContrast: false,
    reduceMotion: false,
    language: 'en',
    ...DEFAULT_RECIPE_PREFS,
    ...DEFAULT_NOTIFICATION_SETTINGS,
  },
};

const PANTRY = '0192f0c0-0000-7000-8000-000000000001';
const HOME = '0192f0c0-0000-7000-8000-000000000002';

export const returningUserMe: MeResponse = {
  ...newUserMe,
  pantry: { id: PANTRY, ownerId: 'u1', homeListId: HOME, createdAt: '2026-09-27T00:00:00.000Z' },
  pantries: [
    {
      id: PANTRY,
      ownerId: 'u1',
      homeListId: HOME,
      createdAt: '2026-09-27T00:00:00.000Z',
      name: 'Home',
      own: true,
      canEdit: true,
    },
  ],
  lists: [
    {
      id: HOME,
      pantryId: PANTRY,
      name: 'Home',
      color: 'navy',
      ownerId: 'u1',
      isHome: true,
      isPrivate: false,
      shopBy: null,
      createdAt: '2026-09-27T00:00:00.000Z',
      role: 'owner',
      members: [{ userId: 'u1', displayName: 'Ananya Mehta', avatarInitial: 'A', role: 'owner' }],
    },
  ],
};

const FAMILY = '0192f0c0-0000-7000-8000-000000000003';
const DIWALI = '0192f0c0-0000-7000-8000-000000000004';
const members = [
  { userId: 'u1', displayName: 'Ananya Mehta', avatarInitial: 'A', role: 'owner' as const },
  { userId: 'u2', displayName: 'Arjun Patel', avatarInitial: 'A', role: 'edit' as const },
  { userId: 'u3', displayName: 'Meera Shah', avatarInitial: 'M', role: 'edit' as const },
];

/** After `pnpm db:seed`: home + Family groceries + Diwali party, with Arjun and Meera. */
export const seededMe: MeResponse = {
  ...returningUserMe,
  lists: [
    { ...returningUserMe.lists[0]!, name: 'Apartment 4B', members },
    {
      ...returningUserMe.lists[0]!,
      id: FAMILY,
      name: 'Family groceries',
      color: 'olive',
      isHome: false,
      members,
    },
    {
      ...returningUserMe.lists[0]!,
      id: DIWALI,
      name: 'Diwali party',
      color: 'amber',
      isHome: false,
      members,
    },
  ],
};
