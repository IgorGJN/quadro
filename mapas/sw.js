/* Mantém o editor disponível offline depois da primeira visita. */
const CACHE = 'mapas-territorio-v6.2';
const SHELL = [
  './',
  'index.html',
  'styles.css?v=6.2',
  'manifest.webmanifest',
  'icon.svg',
  'js/util.js?v=6.2',
  'js/model.js?v=6.2',
  'js/render.js?v=6.2',
  'js/storage.js?v=6.2',
  'js/ui.js?v=6.2',
  'js/osm.js?v=6.2',
  'js/mvt.js?v=6.2',
  'js/vectormap.js?v=6.2',
  'js/territory.js?v=6.2',
  'js/editor.js?v=6.2',
  'js/app.js?v=6.2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Arquivos do próprio app: responde do cache e atualiza em segundo plano.
// Mapas e serviços externos passam direto pela rede.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' });
      const network = fetch(e.request).then((res) => {
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
