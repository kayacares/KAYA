/* KAYA service worker — app shell caching + image CDN caching +
   push notification scaffolding.

   VERSION bump forces every returning tab to install the newer SW
   the next time it opens, at which point old caches (including any
   previous image cache from v1.0.0) are wiped and the fresh runtime
   caches start filling. */
const VERSION = "kaya-v1.1.0-img-cache";
const APP_SHELL = `kaya-shell-${VERSION}`;
const RUNTIME = `kaya-runtime-${VERSION}`;
const IMAGE_CACHE = `kaya-images-${VERSION}`;
const OFFLINE_URL = "/";
const PRECACHE = [
  "/",
  "/manifest.json",
  "/kaya-app-icon.svg",
];

/* Cross-origin hosts whose image responses we're happy to cache
   long-term. Everything else (unknown third parties, tracking
   beacons, analytics pixels) is left untouched to avoid ballooning
   the cache with junk we don't need offline. */
const CACHEABLE_IMAGE_HOSTS = [
  "aomwbzeyhbvppugzaomw.backend.onspace.ai",
  "images.unsplash.com",
  "images.pexels.com",
];

const IMAGE_URL_PATTERN = /\.(?:jpe?g|png|webp|gif|svg|avif)(?:$|\?)/i;
/* Cap the runtime image cache so a chatty catalog can't grow
   without bound. 140 entries × ~40 KB compressed WebP ≈ 5–6 MB,
   which is comfortable inside every browser's default quota. */
const IMAGE_CACHE_MAX_ENTRIES = 140;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== APP_SHELL &&
                k !== RUNTIME &&
                k !== IMAGE_CACHE
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * True for any URL that resolves to an image we're willing to cache
 * long-term. Same-origin build assets under `/assets/*` also pass
 * (Vite emits hashed URLs so the immutability contract holds).
 */
function isCacheableImage(url) {
  if (url.origin === self.location.origin) {
    if (IMAGE_URL_PATTERN.test(url.pathname)) return true;
    if (url.pathname.startsWith("/assets/")) return true;
    return false;
  }
  return CACHEABLE_IMAGE_HOSTS.some((h) => url.hostname.endsWith(h));
}

/**
 * FIFO trim keyed on insertion order so the oldest images fall out
 * first once we're over the cap. Called fire-and-forget after every
 * successful cache write so it never blocks the response.
 */
async function trimImageCache() {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const keys = await cache.keys();
    if (keys.length <= IMAGE_CACHE_MAX_ENTRIES) return;
    const overflow = keys.length - IMAGE_CACHE_MAX_ENTRIES;
    await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)));
  } catch {
    /* Cache API errors are non-fatal — next fetch will just miss */
  }
}

/**
 * Cache-first strategy tuned for image tiles. On a repeat visit
 * every card paints from the local cache instantly; new URLs still
 * hit the network once and are then cached for next time. Opaque
 * cross-origin responses are cached too so Unsplash/Pexels/Supabase
 * work even without CORS headers on the response.
 */
function handleImageFetch(request) {
  return caches.open(IMAGE_CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const res = await fetch(request);
      if (res && (res.ok || res.type === "opaque")) {
        // Fire-and-forget: writing to the cache (and trimming
        // afterwards) doesn't block the response. If the SW dies
        // mid-trim, the next fetch just cleans up a slightly larger
        // cache instead — no correctness loss.
        cache
          .put(request, res.clone())
          .then(() => trimImageCache())
          .catch(() => {});
      }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Image caching — handled first so cross-origin CDN URLs are
  // covered before the same-origin bail-out below skips them.
  if (isCacheableImage(url)) {
    event.respondWith(handleImageFetch(req));
    return;
  }

  // Everything below is scoped to same-origin traffic (JS/CSS/HTML).
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations, fallback to cached shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_SHELL).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((m) => m || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ============================================================
 * Push notification scaffolding (dormant until backend is live)
 * Will handle: Order updates · Delivery confirmations
 *              Promotions · Bundle reminders
 * ============================================================ */
self.addEventListener("push", (event) => {
  let payload = {
    title: "KAYA",
    body: "You have a new update.",
    url: "/",
    tag: "kaya",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const options = {
    body: payload.body,
    icon: "/kaya-app-icon.svg",
    badge: "/kaya-app-icon.svg",
    data: { url: payload.url },
    tag: payload.tag,
    renotify: !!payload.renotify,
    vibrate: [60, 30, 60],
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
