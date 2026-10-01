import { newListItem, type ListItem } from '@shelf-life/shared';
import { seededMe } from './fixtures';

export const HOME_LIST = seededMe.lists[0]!.id;
export const FAMILY_LIST = seededMe.lists[1]!.id;

export function listItem(over: Partial<ListItem> = {}): ListItem {
  return {
    ...newListItem(
      { name: 'Eggs', quantity: 12, unit: '' },
      { listId: HOME_LIST, userId: 'u2', now: new Date().toISOString() },
    ),
    ...over,
  };
}
