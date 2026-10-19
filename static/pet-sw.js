/**
 * pet-sw.js - Dedicated Service Worker for Pocket Pet Standalone PWA
 * Enables 100% offline gameplay, fast cached asset delivery, and standalone mobile app experience.
 */

const CACHE_NAME = 'lachlan-pocket-pet-v3';
const PRECACHE_ASSETS = [
  '/pet/',
  '/pet',
  '/css/style.css',
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components/panel.css',
  '/css/components/pocket_pet_tokens.css',
  '/css/components/pocket_pet.css',
  '/css/components/pet_standalone.css',
  '/css/components/cursor.css',
  '/js/theme-switcher.js',
  '/js/pocket_pet_sprites.js',
  '/js/pocket_pet.js',
  '/js/pet-standalone.js',
  '/stickers/pocket_pet-egg.svg',
  '/stickers/pocket_pet-critter.svg',
  '/favicon.ico',
  '/pet-manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
        console.warn('[Pet SW] Pre-cache partial failure:', err);
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
          if (cache !== CACHE_NAME) {
            console.log('[Pet SW] Removing legacy cache:', cache);
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

  // Handle navigation requests (e.g. user opening /pet/)
  if (event.request.mode === 'navigate') {
    if (!url.pathname.startsWith('/pet')) {
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
          // If offline, serve cached /pet/
          return caches.match('/pet/').then(function (cached) {
            return cached || caches.match('/pet') || caches.match(event.request);
          });
        })
    );
    return;
  }

  // Only intercept asset requests directly under /pet or matching precached assets
  const isPrecache = PRECACHE_ASSETS.some(function (p) {
    return url.pathname === p || url.pathname.endsWith(p);
  });
  if (!url.pathname.startsWith('/pet') && !isPrecache) {
    return;
  }

  // Cache-first strategy with network fallback for assets
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
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
