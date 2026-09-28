import { todayIso } from '@shelf-life/shared';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { ItemSheet } from './ItemSheet';

export const Add = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <ItemSheet
        open={open}
        mode="add"
        lists={[
          { id: 'a', name: 'Apartment 4B', color: 'navy' },
          { id: 'b', name: 'Diwali party', color: 'amber' },
        ]}
        defaultListId="a"
        today={todayIso()}
        onClose={() => setOpen(false)}
        onSave={() => setOpen(false)}
      />
    </>
  );
};
