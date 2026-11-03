// Serves the app from the device at once and refreshes the copy in the background,
// so a weak connection at night never leaves anyone on a loading screen.
const CACHE = 'flaum-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/fonts/dm-sans-latin.woff2',
  './assets/fonts/dm-sans-latin-ext.woff2',
  './src/styles.css',
  './src/main.js',
  './src/core/catalog.js',
  './src/core/contractions.js',
  './src/core/demo.js',
  './src/core/describe.js',
  './src/core/growth.js',
  './src/core/ics.js',
  './src/core/parse.js',
  './src/core/pregnancy.js',
  './src/core/reports.js',
  './src/core/sleep.js',
  './src/core/store.js',
  './src/core/time.js',
  './src/core/timers.js',
  './src/core/who-data.js',
  './src/ui/app.js',
  './src/ui/charts.js',
  './src/ui/dom.js',
  './src/ui/views/contraction.js',
  './src/ui/views/history.js',
  './src/ui/views/home.js',
  './src/ui/views/log.js',
  './src/ui/views/more.js',
  './src/ui/views/onboarding.js',
  './src/ui/views/plan.js',
  './src/ui/views/report.js',
  './src/ui/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('flaum-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? refresh;
    }),
  );
});
