import { Button } from '../Button/Button';
import { ToastProvider, useToast } from './Toast';

function Demo() {
  const toast = useToast();
  return (
    <Button
      onClick={() =>
        toast({
          message: 'Spinach moved to Ran out.',
          action: { label: 'Undo', onAction: () => undefined },
        })
      }
    >
      Show toast
    </Button>
  );
}

export const WithUndo = () => (
  <ToastProvider>
    <Demo />
  </ToastProvider>
);
