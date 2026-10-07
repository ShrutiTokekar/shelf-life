import { safeStorage } from './storage';

const SUB_KEY = 'shelf-life:push-sub';

export type PushSupport = 'supported' | 'ios-install' | 'unsupported' | 'denied';

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Can this browser show Shelf Life notifications? (SRS 8.8) iPhone and iPad need the app added
 * to the Home Screen first; without push, reminders stay in the app (SRS 12.3).
 */
export function pushSupport(): PushSupport {
  const capable =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!capable) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'supported';
}

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`push ${path}: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** Is push on for this device right now? */
export async function pushEnabledHere(): Promise<boolean> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription()) && !!safeStorage.get(SUB_KEY);
}

export type EnableResult = 'on' | 'denied' | 'unavailable';

/** Ask permission (only when the person taps), subscribe this device, and tell the API. */
export async function enablePush(): Promise<EnableResult> {
  if (pushSupport() !== 'supported') return 'unavailable';
  const { enabled, publicKey } = (await api('/push/key')) as {
    enabled: boolean;
    publicKey: string | null;
  };
  if (!enabled || !publicKey) return 'unavailable';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey) as BufferSource,
    }));
  const { id } = (await api('/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(sub.toJSON()),
  })) as { id: string };
  safeStorage.set(SUB_KEY, id);
  return 'on';
}

/** Turn push off for this device (also on sign-out: a shared phone stops getting your alerts). */
export async function disablePush(): Promise<void> {
  const id = safeStorage.get(SUB_KEY);
  safeStorage.remove(SUB_KEY);
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // Nothing subscribed here.
  }
  if (id)
    await api(`/push/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
}

/** RMD-4: tell the others on that item's list it ran out (best effort; the hourly job follows up). */
export function notifyRanOut(input: {
  pantryId: string;
  listId: string;
  itemId: string;
  itemName: string;
}): void {
  if (!navigator.onLine) return;
  void api('/push/ran-out', { method: 'POST', body: JSON.stringify(input) }).catch(() => undefined);
}
