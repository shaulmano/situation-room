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
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
