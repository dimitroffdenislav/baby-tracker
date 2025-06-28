const CACHE_NAME = 'baby-tracker-v2';
const BASE_PATH = '/baby-tracker';
const FILES_TO_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/css/style.css`,
  `${BASE_PATH}/js/app.js`,
  `${BASE_PATH}/js/ui.js`,
  `${BASE_PATH}/js/db.js`,
  `${BASE_PATH}/js/auth.js`,
  `${BASE_PATH}/js/firebaseConfig.js`,
  `${BASE_PATH}/icons/icon-192.png`,
  `${BASE_PATH}/icons/icon-512.png`
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  if (evt.request.mode !== 'navigate') return;
  evt.respondWith(
    fetch(evt.request).catch(() => caches.match(`${BASE_PATH}/index.html`))
  );
});
