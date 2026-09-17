/*
 * Cache-first de um conjunto versionado e completo de arquivos estáticos.
 * Uma nova versão aguarda as abas antigas fecharem antes de assumir.
 *
 * Incremente CACHE_VERSION sempre que publicar alterações no app.
 */
const CACHE_VERSION = 'treino-v7-agent-ui';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/storage.js',
  './js/plans.js',
  './js/records.js',
  './js/api.js',
  './js/sync.js',
  './js/coach-policy.js',
  './js/program.js',
  './js/progression.js',
  './js/components/chart.js',
  './js/views/sessions.js',
  './js/views/session.js',
  './js/views/history.js',
  './js/views/settings.js',
  './js/views/agent.js',
  './js/views/connection.js',
  './js/vendor/idb-keyval.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  const allowed = new Set(ASSETS.map((path) => new URL(path, self.registration.scope).pathname));
  if (!allowed.has(new URL(request.url).pathname)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const fresh = await fetch(request).catch(() => null);
      if (fresh) return fresh;
      // Offline e fora do cache: rotas de navegação caem no shell.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    })
  );
});
