// Physiq — Service Worker with cache versioning (Safari PWA fix)
// Version string for cache busting
const CACHE_VERSION = 'v10';
const CACHE_NAME = `physiq-${CACHE_VERSION}`;

// Relative paths so precache works under BOTH /physiq/ (GitHub Pages) and the
// custom-domain root (physiq.lrghomes.com). Root-absolute paths 404'd under /physiq/.
const STATIC_ASSETS = [
  './',
  './index.html',
  './sw.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(e => {
        console.warn('[SW] Cache.addAll failed (expected in dev):', e);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      // Delete OLD caches (e.g., physiq-v1)
      return Promise.all(
        keys
          .filter(k => k.startsWith('physiq-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET or cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML: network-first with a 3.5s cutoff — always try fresh code, but a
  // stalled request (dead connection on PWA resume) serves the cached copy
  // instead of blanking the screen until the OS times out. The network fetch
  // keeps running in the background to update the cache for next open.
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith((async () => {
      const network = fetch(request).then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      });
      const cached = await caches.match(request);
      if (!cached) return network.catch(() => caches.match(request)); // first visit: nothing to fall back to
      const winner = await Promise.race([
        network.catch(() => null),
        new Promise(res => setTimeout(() => res(null), 3500)),
      ]);
      return winner || cached;
    })());
    return;
  }

  // JSON/API: network-first (always check for fresh data)
  if (url.pathname.endsWith('.json') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: stale-while-revalidate (cache-first with background update)
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
