import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ListTabs } from '../ListTabs/ListTabs';
import { ListSwitcher, SwitchListsSheet, type SwitcherList } from './ListSwitcher';

const base = {
  pantryId: 'p',
  ownerId: 'u1',
  isHome: false,
  isPrivate: false,
  shopBy: null,
  createdAt: '',
  role: 'owner' as const,
  members: [],
};
const lists: SwitcherList[] = [
  {
    ...base,
    id: 'a',
    name: 'Apartment 4B',
    color: 'navy',
    isHome: true,
    toBuy: 4,
    people: [
      { name: 'Shruti', initial: 'S', tone: 'periwinkle' },
      { name: 'Maya', initial: 'M', tone: 'sage' },
      { name: 'Arjun', initial: 'A', tone: 'peach' },
    ],
  },
  {
    ...base,
    id: 'd',
    name: 'Diwali party',
    color: 'amber',
    toBuy: 12,
    people: [
      { name: 'Shruti', initial: 'S', tone: 'periwinkle' },
      { name: 'Priya', initial: 'P', tone: 'apricot' },
    ],
  },
  { ...base, id: 'j', name: 'Just me', color: 'gray', isPrivate: true, toBuy: 2, people: [] },
];

export const SwitcherAndTabs = () => {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <div className="flex flex-col gap-6">
        <ListSwitcher list={lists[0]!} onOpen={() => setOpen(true)} />
        <ListTabs lists={lists} activeId="a" />
        <SwitchListsSheet open={open} lists={lists} currentId="a" onClose={() => setOpen(false)} />
      </div>
    </MemoryRouter>
  );
};
