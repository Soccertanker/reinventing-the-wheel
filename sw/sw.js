/* Service worker: makes the web build work offline and installable.
 * Template: vite.config.ts replaces __CACHE_NAME__ and __PRECACHE__ at build time
 * with this build's version and file list, so each release gets a fresh cache.
 *
 * Strategy:
 *   - install: precache every file of this build (works offline after the first visit)
 *   - page loads: network first (players get new releases when online), cache when offline
 *   - fingerprinted assets: cache first (their names change whenever content changes)
 *   - activate: delete caches from older builds
 */
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
