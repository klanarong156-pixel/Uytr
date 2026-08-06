<<<<<<< HEAD
const CACHE_NAME = 'suan-lung-na-v3';
=======
const CACHE_NAME = 'suan-lung-na-v2';
>>>>>>> cfe7be8 (Fix: Update Service Worker to v2 to clear stale login screen, and add interactive toggles to Home page for easier control)
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './premium.css',
  './script.js',
  './premium.js',
  './logo.png',
  './manifest.json'
];

<<<<<<< HEAD
self.addEventListener('install', (event) => {
  self.skipWaiting();
=======
// Install Event
self.addEventListener('install', event => {
>>>>>>> cfe7be8 (Fix: Update Service Worker to v2 to clear stale login screen, and add interactive toggles to Home page for easier control)
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

<<<<<<< HEAD
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
=======
// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network First Strategy for dashboard data, Cache fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
>>>>>>> cfe7be8 (Fix: Update Service Worker to v2 to clear stale login screen, and add interactive toggles to Home page for easier control)
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // For HTML pages, always fetch from network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
