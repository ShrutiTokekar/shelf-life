import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../lib/i18n';
import { resetDocsForTests } from '../lib/sync/docs';
import { useRecipeStore } from '../stores/recipes';

// jsdom lacks these; Radix Select and scroll-into-view calls need them.
// (Guarded: node-environment tests like tokens.test.ts share this setup file.)
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
}

// Integration tests load lazy routes and IndexedDB; allow more than the 1 s default under load.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  resetDocsForTests();
  useRecipeStore.getState().clear();
  // Fresh device storage for every test.
  globalThis.indexedDB = new IDBFactory();
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
});
