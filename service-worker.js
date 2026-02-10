/* MiniPhone Service Worker - Cache-first for static assets */
const CACHE_NAME = 'miniphone-v10';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css',
    './css/base.css',
    './css/layout.css',
    './css/components.css',
    './css/apps/chat.css',
    './css/apps/character.css',
    './css/apps/moments.css',
    './js/main.js',
    './js/core/db.js',
    './js/core/storage.js',
    './js/core/router.js',
    './js/core/utils.js',
    './js/services/api.js',
    './js/apps/chat.js',
    './js/apps/character.js',
    './js/apps/moments.js',
    './js/apps/settings.js',
    './icons/icon-192.svg',
    './icons/icon-512.svg'
];

// Install: cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching static assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first for local assets, network-first for API calls
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip caching for API calls and CDN resources
    if (url.origin !== location.origin || event.request.method !== 'GET') {
        return; // Let the browser handle it normally
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            // Return cache if found, else fetch from network and cache it
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
                return caches.match('./index.html');
            }
        })
    );
});
