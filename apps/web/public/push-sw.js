/* global self */
/* Shelf Life Web Push (SRS 8.8, RMD-4). Loaded into the service worker by vite-plugin-pwa.
 * Payload: { title, body, url, tag, actions?: [{ action, title, url }] }. Item names only. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Shelf Life', body: event.data ? event.data.text() : '' };
  }
  const actions = Array.isArray(data.actions) ? data.actions : [];
  event.waitUntil(
    self.registration.showNotification(data.title || 'Shelf Life', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/', actions },
      actions: actions.map((a) => ({ action: a.action, title: a.title })),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/', actions = [] } = event.notification.data || {};
  const chosen = actions.find((a) => a.action === event.action);
  // "Not now" (no url) just closes the notification.
  if (chosen && !chosen.url) return;
  const target = new URL(chosen ? chosen.url : url, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          await w.focus();
          return w.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
