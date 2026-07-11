const VERSION = "swu-collection-v2";
const APP_CACHE = `${VERSION}-app`;
const IMAGE_CACHE = `${VERSION}-images`;
const ROOT = new URL("./", self.location.href).pathname;
const local = (path) => `${ROOT}${path}`.replace(/\/+/g, "/");

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll([ROOT, local("manifest.webmanifest"), local("cards.json"), local("icons/icon-192.png")]);
    const home = await cache.match(ROOT);
    if (home) {
      const html = await home.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], self.location.origin + ROOT))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
      await cache.addAll([...new Set(assets)]);
    }
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![APP_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key)))));
  self.clients.claim();
});

async function trimImages(cache, limit = 80) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isCardImage = url.hostname === "cdn.swu-db.com";
  if (isCardImage) {
    event.respondWith(caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        await cache.delete(event.request);
        await cache.put(event.request, cached.clone());
        return cached;
      }
      try {
        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") {
          await cache.put(event.request, response.clone());
          await trimImages(cache);
        }
        return response;
      } catch { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
  event.respondWith(caches.open(APP_CACHE).then(async (cache) => {
    const cached = await cache.match(event.request);
    if (url.pathname.includes(`${ROOT}assets/`) && cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return cached || (await cache.match(ROOT)) || Response.error();
    }
  }));
});
