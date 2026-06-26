/* Service Worker — IT Operations Knowledge Base */
const CACHE_BASE = 'it-ops-kb';
const VERSION_ENDPOINT = '/version';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/fonts/inter.css',
  '/fonts/inter-regular.woff2',
  '/fonts/inter-medium.woff2',
  '/fonts/inter-semibold.woff2',
  '/fonts/inter-bold.woff2',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

let currentCacheName = CACHE_BASE;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(currentCacheName)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    fetch(VERSION_ENDPOINT)
      .then((res) => res.json())
      .then((data) => {
        const newCacheName = CACHE_BASE + '-' + data.version;
        return caches
          .open(newCacheName)
          .then((cache) => cache.addAll(STATIC_ASSETS))
          .then(() => {
            currentCacheName = newCacheName;
            // Delete old caches
            return caches
              .keys()
              .then((keys) =>
                Promise.all(keys.filter((k) => k !== newCacheName).map((k) => caches.delete(k))),
              );
          });
      })
      .catch(() => {
        // If version endpoint fails, use existing cache
        return self.clients.claim();
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Network-only for API routes (session-based, no offline data benefit)
  // Stale-while-revalidate for static assets
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    // Network-only: no caching to avoid leaking auth data between sessions
    event.respondWith(fetch(event.request).catch(() => new Response(null, { status: 503 })));
  } else if (event.request.mode === 'navigate') {
    // Navigation requests (SPA routes): network-first, fall back to cached app shell
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((cached) => cached || new Response(null, { status: 503 })),
      ),
    );
  } else {
    // Stale-while-revalidate for static assets (updates propagate on next visit)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              event.waitUntil(
                caches
                  .open(currentCacheName)
                  .then((cache) => cache.put(event.request, response.clone()))
                  .catch(() => {}),
              );
            }
            return response;
          })
          .catch(() => cached || new Response(null, { status: 503 }));
        return cached || fetchPromise;
      }),
    );
  }
});
