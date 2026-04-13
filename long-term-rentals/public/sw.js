const CACHE_NAME = 'long-term-rentals-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// Instalación del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación del service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  // No interceptar mutaciones ni API: siempre red en vivo
  if (event.request.method !== 'GET') {
    return;
  }
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // En desarrollo, siempre priorizar la red sobre el caché
  // Solo usar caché para recursos estáticos en producción
  const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    // En desarrollo: Network First - siempre intentar la red primero
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, actualizar el caché
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Solo usar caché si la red falla
          return caches.match(event.request);
        })
    );
  } else {
    // En producción: cache solo para assets estáticos, resto network-first
    const isStaticAsset =
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'image' ||
      event.request.destination === 'font';

    if (!isStaticAsset) {
      event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
      );
      return;
    }

    // En producción (assets): Cache First con fallback a red
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Devolver desde caché si está disponible
          if (response) {
            return response;
          }
          
          // Si no está en caché, hacer la petición a la red
          return fetch(event.request).then(
            (response) => {
              // Verificar si la respuesta es válida
              if(!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              // Clonar la respuesta
              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            }
          );
        })
    );
  }
});

// Manejo de notificaciones push
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver más',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/logo192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Long-Term Rentals', options)
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Realizar sincronización de datos
      console.log('Background sync triggered')
    );
  }
});

// Manejo de mensajes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
