/* Service worker: caches the app shell so the app opens instantly and
   still loads offline. Firestore handles its own offline queue/sync
   for data (see enableIndexedDbPersistence in app.js) — this worker
   only takes care of the static files. */

// Bump on every shell change — the fetch handler is cache-first, so a stale
// name would keep serving the old app.js forever.
const CACHE_NAME = "pho-pos-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase/Firestore traffic — let it hit the network
  // (or Firestore's own offline cache) directly.
  if (url.hostname.includes("firestore") || url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
