import { describe, expect, it } from 'vitest';
import { applyUiSettings, useUiSettings } from './uiSettings';

describe('ui settings', () => {
  it('A11Y-6 sets data-text-size on <html> (CSS scales root font size to 100/115/130%)', () => {
    const root = document.createElement('html');
    applyUiSettings(root, { textSize: 'largest', highContrast: false, reduceMotion: false });
    expect(root.dataset.textSize).toBe('largest');
  });

  it('A11Y-7 high contrast and reduce motion set attributes only when on, so OS preferences still apply', () => {
    const root = document.createElement('html');
    applyUiSettings(root, { textSize: 'default', highContrast: true, reduceMotion: true });
    expect(root.dataset.contrast).toBe('high');
    expect(root.dataset.motion).toBe('reduce');
    applyUiSettings(root, { textSize: 'default', highContrast: false, reduceMotion: false });
    expect(root.dataset.contrast).toBeUndefined();
    expect(root.dataset.motion).toBeUndefined();
  });

  it('persists choices on this device', () => {
    useUiSettings.getState().setTextSize('large');
    expect(JSON.parse(window.localStorage.getItem('shelf-life:ui-settings')!).state.textSize).toBe(
      'large',
    );
  });
});
