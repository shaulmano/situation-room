// v3 — badge support.
// A service worker normally waits for every tab to close before it replaces the
// running one, so a fix here reached nothing while the app stayed open. These
// two lines make a new version take over on the next launch instead.
const SW_VERSION = 3;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Push arrives here even with the app closed. iOS only delivers to a page
// installed to the Home Screen, which is Apple's rule, not a limitation here.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* keep defaults */ }

  const title = data.title || 'חדר המצב';
  const options = {
    body: data.body || 'נמצאו משרות חדשות',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'new-jobs',
    // Replace an unread alert rather than stacking six of them.
    renotify: true,
    data: { url: data.url || '/' },
  };
  // The badge is the count of unseen jobs, not of notifications — a batch of 47
  // is one alert and a 47 on the icon.
  const badge = Number(data.count) || 0;
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    badge > 0 && self.navigator.setAppBadge
      ? self.navigator.setAppBadge(badge).catch(() => {})
      : Promise.resolve(),
  ]));
});

// The app asks for the badge to be cleared once it has been opened; doing it
// from the service worker means it works whichever window is in front.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-badge' && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge().catch(() => {});
  }
  if (event.data?.type === 'version') {
    event.source?.postMessage({
      type: 'version',
      version: SW_VERSION,
      canBadge: typeof self.navigator.setAppBadge === 'function',
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(new URL(url, self.location.origin).pathname) && 'focus' in c) {
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
