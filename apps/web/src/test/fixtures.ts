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
  settings: { textSize: 'default', highContrast: false, reduceMotion: false, language: 'en' },
};

const PANTRY = '0192f0c0-0000-7000-8000-000000000001';
const HOME = '0192f0c0-0000-7000-8000-000000000002';

export const returningUserMe: MeResponse = {
  ...newUserMe,
  pantry: { id: PANTRY, ownerId: 'u1', homeListId: HOME, createdAt: '2026-09-27T00:00:00.000Z' },
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
    },
  ],
};
