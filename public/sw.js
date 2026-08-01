self.addEventListener('push', (event) => {
  let data = {
    title: 'VAKİT',
    body: 'Namaz vakti bildirimi',
    icon: '/icons/notification-icon.png',
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (err) {
    // Bozuk payload — varsayılan metinlerle devam et.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
