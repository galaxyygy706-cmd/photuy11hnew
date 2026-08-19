/* Service worker: keeps the app opening instantly and working offline.
   Firestore handles its own offline queue/sync for data (see
   enableIndexedDbPersistence in app.js) — this worker only takes care of
   the static files.

   The app shell is served NETWORK-FIRST on purpose. A pure cache-first
   worker will happily serve a months-old app.js forever: bumping
   CACHE_NAME only helps once the new worker actually installs, and until
   then the till keeps running code you already fixed. Network-first means
   a reload with signal always lands the current build, while the cached
   copy still covers a dead connection. */

const CACHE_NAME = "pho-pos-shell-v6";
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

/** Code and markup: things that change when we ship a fix. */
function isShellRequest(request, url) {
  return request.mode === "navigate" || /\.(?:html|css|js|json)$/.test(url.pathname);
}

function cachePut(request, response) {
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase/Firestore traffic — let it hit the network
  // (or Firestore's own offline cache) directly.
  if (url.hostname.includes("firestore") || url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
    return;
  }

  if (event.request.method !== "GET") return;

  if (isShellRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => cachePut(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Icons and other static assets: cache-first is fine, they rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => cachePut(event.request, response))
        .catch(() => caches.match("./index.html"));
    })
  );
});
