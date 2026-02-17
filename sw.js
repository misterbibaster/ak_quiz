const CACHE_NAME = "ak-quiz-cache-v1";
const SHELL_CACHE = "ak-quiz-shell-v1";
const SHELL_ASSETS = [
  "./",
  "./index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "warmup-assets" || !Array.isArray(data.assets)) return;
  const assets = data.assets.filter((item) => typeof item === "string" && item.length > 0);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        assets.map((url) =>
          cache.match(url).then((hit) => {
            if (hit) return null;
            return fetch(url).then((response) => {
              if (!response || !response.ok) return null;
              return cache.put(url, response.clone());
            }).catch(() => null);
          })
        )
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("./index.html", cloned)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
