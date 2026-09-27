import type { GlobalProvider } from '@ladle/react';
import { MemoryRouter } from 'react-router-dom';
import '../src/lib/i18n';
import '../src/styles/index.css';

export const Provider: GlobalProvider = ({ children }) => (
  <MemoryRouter>
    <div className="bg-cream p-6">{children}</div>
  </MemoryRouter>
);
