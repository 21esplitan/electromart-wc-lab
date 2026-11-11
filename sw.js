// Service worker: network-first, with the cache as the offline fallback.
// Network-first means a merged change shows up as soon as the device is online.
// All paths are relative, because the site lives at https://<username>.github.io/<repository>/.

const CACHE = 'electromart-ccc-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'ccc.js',
  'manifest.webmanifest',
  'data/electromart.csv',
  'data/assumptions.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// Save the app's files when the service worker installs, so the app works offline right away.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

// Delete caches from older versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Try the network first and keep a fresh copy. If the network fails, use the cache.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('index.html')))
  );
});
