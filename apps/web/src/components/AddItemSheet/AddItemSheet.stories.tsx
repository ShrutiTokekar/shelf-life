import { useState } from 'react';
import { Button } from '../Button/Button';
import { AddItemSheet } from './AddItemSheet';

const noop = () => undefined;

export const AddToList = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add item</Button>
      <AddItemSheet
        open={open}
        listName="Apartment 4B"
        isPrivate={false}
        members={[
          { userId: 'u1', name: 'Shruti', initial: 'S', tone: 'periwinkle', isYou: true },
          { userId: 'u2', name: 'Maya', initial: 'M', tone: 'sage', isYou: false },
          { userId: 'u3', name: 'Arjun', initial: 'A', tone: 'peach', isYou: false },
        ]}
        ranOut={[]}
        onAdd={() => setOpen(false)}
        onSave={noop}
        onDelete={noop}
        onRanOut={noop}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
