const CACHE_NAME = 'waroenk-pos-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script-core.js',
  '/script-admin.js',
  '/script-pos.js'
];

// Install Service Worker & Simpan Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Aktifkan Service Worker & Hapus Cache Lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cegat request network (Agar aplikasi lebih cepat dan bisa memuat aset meski koneksi lemot)
self.addEventListener('fetch', event => {
  // Hanya cegat request GET lokal, biarkan request ke API Google Apps Script & Firebase berjalan normal
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com') || event.request.url.includes('firebase')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
