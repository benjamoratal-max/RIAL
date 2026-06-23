/* eslint-disable no-undef */
/**
 * Handlers de Web Push para RIAL.
 *
 * Este archivo se inyecta dentro del service worker generado por vite-plugin-pwa
 * (workbox) mediante `workbox.importScripts`. Recibe los pushes del backend y muestra
 * la notificación del sistema; al tocarla, abre/enfoca la app en la URL indicada.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'RIAL', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'RIAL';
  const options = {
    body: data.body || '',
    icon: '/rial-icon-192.png',
    badge: '/rial-icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana de la app abierta, la enfocamos y navegamos.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      // Si no, abrimos una nueva.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
