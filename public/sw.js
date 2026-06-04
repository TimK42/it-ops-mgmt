/* Service Worker — IT Operations Knowledge Base */
const CACHE = 'it-ops-kb-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/fonts/inter.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for API routes, cache-first for static assets
  // Exclude auth endpoints to avoid caching session-sensitive data
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
    // Network-first: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache successful API responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || new Response(null, { status: 503 })),
        ),
    );
  } else {
    // Cache-first for static assets
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
