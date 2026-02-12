/* MiniPhone Service Worker - Cache-first for static assets */
const CACHE_NAME = 'miniphone-v68';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css?v=68',
    './css/base.css?v=68',
    './css/layout.css?v=68',
    './css/components.css?v=68',
    './css/apps/chat.css?v=68',
    './css/apps/character.css?v=68',
    './css/apps/moments.css?v=68',
    './css/apps/voicecall.css?v=68',
    './js/main.js?v=68',
    './js/core/storage.js?v=68',
    './js/core/router.js?v=68',
    './js/core/utils.js?v=68',
    './js/services/api.js?v=68',
    './js/services/tts.js?v=68',
    './js/services/supabase.js?v=68',
    './js/apps/chat.js?v=68',
    './js/apps/character.js?v=68',
    './js/apps/moments.js?v=68',
    './js/apps/settings.js?v=68',
    './js/apps/voicecall.js?v=68',
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
