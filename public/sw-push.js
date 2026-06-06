// Push notification service worker handler
// This file is imported by the next-pwa generated service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Lineup Mate', body: event.data.text() };
  }

  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192.png',
    badge: data.badge ?? '/icons/icon-72.png',
    data: { url: data.url ?? '/' },
    tag: data.tag ?? 'lineup-mate',
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lineup Mate', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
