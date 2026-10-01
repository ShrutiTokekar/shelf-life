import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './lib/i18n';
import { enableSync } from './lib/sync/provider';
import './styles/index.css';

registerSW({ immediate: true });
// Live sync with the sync service (SRS 11.2). Off in component tests, which have no server.
enableSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
