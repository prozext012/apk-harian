// ================== PWA (Manifest + Service Worker inline) ==================
const manifestData = {
    "name": "dixzAPK",
    "short_name": "dixzAPK",
    "description": "dixzAPK - Comic Life Application",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#f8f9fa",
    "theme_color": "#5b9bd5",
    "icons": [
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "72x72", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "96x96", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "128x128", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "144x144", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "152x152", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "384x384", "type": "image/png", "purpose": "any maskable" },
        { "src": "https://i.supaimg.com/d303cdfa-9ede-4b8f-a7e8-331f9fa15dbb.jpg", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
    ],
    "categories": ["lifestyle", "utilities"],
    "lang": "id",
    "dir": "ltr"
};
const manifestBlob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(manifestBlob);
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = manifestURL;
document.head.appendChild(manifestLink);

const swCode = `
    const CACHE_NAME = 'dixzAPK-v1';
    const urlsToCache = ['./'];
    self.addEventListener('install', (event) => {
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).then(() => self.skipWaiting()));
    });
    self.addEventListener('activate', (event) => {
        event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
    });
    self.addEventListener('fetch', (event) => {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) return response;
                return fetch(event.request).then((response) => {
                    if (!response || response.status !== 200 || response.type !== 'basic') return response;
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    return response;
                }).catch(() => new Response('Offline'));
            })
        );
    });
`;
if ('serviceWorker' in navigator) {
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swURL, { scope: './' })
        .then((r) => console.log('dixzAPK Service Worker registered:', r.scope))
        .catch((e) => console.log('dixzAPK Service Worker gagal:', e));
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('dixzAPK dapat diinstal!');
});

