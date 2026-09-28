import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/Toast/Toast';
import { SessionProvider } from './lib/session';
import { createRouter } from './router';
import { applyUiSettings, useUiSettings } from './stores/uiSettings';

function useApplyUiSettings() {
  const textSize = useUiSettings((s) => s.textSize);
  const highContrast = useUiSettings((s) => s.highContrast);
  const reduceMotion = useUiSettings((s) => s.reduceMotion);
  useEffect(() => {
    applyUiSettings(document.documentElement, { textSize, highContrast, reduceMotion });
  }, [textSize, highContrast, reduceMotion]);
}

export function App() {
  const [router] = useState(createRouter);
  useApplyUiSettings();
  return (
    <SessionProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SessionProvider>
  );
}
