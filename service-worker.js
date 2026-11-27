const CACHE_NAME = 'lifeos-shell-v8';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './src/styles.css', './src/app.js',
  './src/crypto.js', './src/database.js', './src/preferences.js', './src/validation.js', './src/dom.js',
  './src/modules/dashboard.js', './src/modules/tasks.js', './src/modules/calendar.js',
  './src/modules/habits.js', './src/modules/goals.js',
  './src/modules/study.js', './src/modules/projects.js', './src/modules/notes.js', './src/modules/focus.js',
  './src/modules/fitness.js', './src/modules/analytics.js', './src/modules/knowledge-graph.js', './src/modules/customization.js', './src/modules/accessibility.js',
  './public/icons/lifeos-192.svg', './public/icons/lifeos-512.svg'
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('lifeos-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
