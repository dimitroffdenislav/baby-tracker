const CACHE_NAME = 'baby-tracker-v1';
 const FILES_TO_CACHE = [
   '/',
   '/index.html',
   '/css/style.css',
   '/js/app.js',
   '/js/ui.js',
   '/js/db.js',
   '/js/auth.js',
   '/js/firebaseConfig.js',
   '/icons/icon-192.png',
   '/icons/icon-512.png'
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
     fetch(evt.request).catch(() => caches.match('index.html'))
   );
 });
