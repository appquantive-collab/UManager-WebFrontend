const CACHE = "umanager-shell-v5";
// Replaced at build time with the hashed asset list (see vite.config.ts).
const SHELL = ["/", "/manifest.webmanifest", "/logo-192.png", "/logo-512.png"];

// The navigation fallback is keyed on "/" — many static hosts redirect
// "/index.html" to "/", which would otherwise poison the cache with a 404.
const SHELL_DOC = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const response = await fetch(path, { cache: "reload" });
            if (response.ok) await cache.put(path, response);
          } catch {
            // A failed precache entry must not abort the whole install.
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Business data must never be served stale.
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigations: fall back to the cached shell document so every client-side
  // route still resolves when the network is gone.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL_DOC, copy));
            return response;
          }
          // A 404 here is usually a host without SPA rewrites: the client-side
          // router owns this path, so hand back the shell instead of the error.
          const shell = await caches.open(CACHE).then((c) => c.match(SHELL_DOC));
          return shell ?? response;
        } catch {
          const shell = await caches.open(CACHE).then((c) => c.match(SHELL_DOC));
          return shell ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  // Static assets: cache-first, populating on first successful fetch.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
