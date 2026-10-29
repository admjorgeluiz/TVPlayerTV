// TVPlayer Service Worker for Desktop PWA Installation
const CACHE_NAME = 'tvplayer-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle all stream and dynamic requests directly
  // This satisfies the PWA installability requirement for Chrome & Edge
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
