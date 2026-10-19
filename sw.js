const CACHE = "momconnect-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  // Do NOT skipWaiting here — the update banner relies on a waiting worker.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache Supabase API / auth / storage responses
  if (url.hostname.includes("supabase")) return;

  // Navigations: network-first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) || (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Static assets + CDN: cache-first
  if (url.hostname === "cdn.jsdelivr.net" || /\.(css|js|woff2|png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type !== "opaque") cache.put(req, res.clone());
        return res;
      } catch {
        return hit || Response.error();
      }
    })());
  }
});
