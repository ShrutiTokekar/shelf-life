import { useState } from 'react';
import { Button } from '../Button/Button';
import { ConfirmDialog } from './ConfirmDialog';

export const DeleteReceipt = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete receipt
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this receipt?"
        body="The receipt’s text is removed from your history. Items it added stay in your pantry."
        confirmLabel="Delete receipt"
        cancelLabel="Keep it"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};
