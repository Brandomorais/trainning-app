/*
 * Service worker: pré-cacheia o app inteiro na instalação e responde
 * stale-while-revalidate — serve do cache na hora (offline garantido)
 * e atualiza o cache em segundo plano quando há rede. Uma nova versão
 * do app é aplicada na abertura seguinte.
 *
 * CACHE_VERSION só precisa mudar em alterações estruturais (arquivo
 * renomeado/removido); edições normais chegam sozinhas via revalidação.
 */
const CACHE_VERSION = 'treino-v3'; // v3: rampa calculada + horário de volta

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/program.js',
  './js/progression.js',
  './js/components/chart.js',
  './js/views/sessions.js',
  './js/views/session.js',
  './js/views/history.js',
  './js/views/settings.js',
  './js/vendor/idb-keyval.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
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

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) return cached;
      const fresh = await network;
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
