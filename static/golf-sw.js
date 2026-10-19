/**
 * golf-sw.js - Dedicated Service Worker for Desert Golfing Standalone Fullscreen PWA
 * Enables 100% offline gameplay, instant cached asset delivery, and fullscreen standalone mobile experience.
 */

const CACHE_NAME = 'lachlan-desert-golfing-v3';
const PRECACHE_ASSETS = [
  '/golf/',
  '/golf',
  '/golf-manifest.json',
  '/css/components/desert_golfing_standalone.css',
  '/js/pwa-runtime.js',
  '/js/desert-golfing.js',
  '/stickers/desert-golfing-icon.svg',
  '/favicon.ico'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
        console.warn('[Golf SW] Pre-cache partial warning:', err);
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cache) {
          if (cache !== CACHE_NAME && cache.startsWith('lachlan-desert-golfing-')) {
            console.log('[Golf SW] Removing outdated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Handle navigation requests (e.g. user opening /golf/)
  if (event.request.mode === 'navigate') {
    if (!url.pathname.startsWith('/golf')) {
      return;
    }
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(event.request, responseClone);
            }).catch(function () {});
          }
          return response;
        })
        .catch(function () {
          // If offline or network fails, serve cached /golf/
          return caches.match('/golf/').then(function (cached) {
            return cached || caches.match('/golf') || caches.match(event.request);
          });
        })
    );
    return;
  }

  // Only intercept asset requests matching precached assets or under /golf
  const isPrecache = PRECACHE_ASSETS.some(function (p) {
    return url.pathname === p || url.pathname.endsWith(p);
  });
  if (!url.pathname.startsWith('/golf') && !isPrecache) {
    return;
  }

  // Cache-first strategy with background stale-while-revalidate update
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        // Fetch update in background
        fetch(event.request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(event.request, clone);
            }).catch(function () {});
          }
        }).catch(function () {});
        return cachedResponse;
      }

      return fetch(event.request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(event.request, responseToCache);
        }).catch(function () {});
        return networkResponse;
      }).catch(function () {
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
