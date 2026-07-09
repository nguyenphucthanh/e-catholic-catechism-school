const CACHE_NAME = 'giaoly-attendance-v1';
const ASSETS_TO_CACHE = [
  '/attendance',
  '/favicon.ico',
  '/site.webmanifest',
];

// Install Service Worker and cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch events: Network-First for routes, Cache-First/Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle http and https requests (ignore chrome-extension, data, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip non-GET requests and Convex API requests
  if (event.request.method !== 'GET' || url.pathname.includes('/api') || url.hostname.includes('convex')) {
    return;
  }

  // Skip Vite dev server requests, HMR, and source files during development
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.searchParams.has('import') ||
    url.searchParams.has('v')
  ) {
    return;
  }

  // Page navigations (e.g. /attendance or /dashboard): Network-First falling back to Cache
  if (event.request.mode === 'navigate' || url.pathname === '/attendance') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the fresh page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fall back to cached page
          return caches.match('/attendance') || caches.match(event.request);
        })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ignore network errors for background fetch
      });

      return cachedResponse || fetchPromise;
    })
  );
});
