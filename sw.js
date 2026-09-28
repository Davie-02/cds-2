/* =========================================================
   SERVICE WORKER — offline support + instant repeat visits
   ---------------------------------------------------------
   A service worker is a small script the browser keeps running
   in the background for this site. It sits between the page and
   the network and decides where each file comes from:

   - Pages (HTML) and content (data/*.json): try the network
     first so visitors always see the latest prices and news;
     if the network is slow (> 3.5s) or offline, use the copy
     saved from last time. If there is no copy, offline.html.
   - CSS, JS, fonts and images: served instantly from the saved
     copy, while a fresh copy is fetched in the background
     ("stale-while-revalidate").

   The /admin CMS and other websites (Formspree, Unsplash, maps)
   are never touched.

   When you change css/style.css or js/script.js, bump the ?v=
   number in the HTML pages AND in CORE_FILES below, and change
   VERSION — old caches are then cleaned up automatically.
   ========================================================= */

const VERSION = "cds-2026092802";
const CORE_FILES = [
  "./",
  "index.html",
  "offline.html",
  "css/style.css?v=2026092802",
  "js/script.js?v=2026092802",
  "fonts/inter-latin.woff2",
  "fonts/sora-latin.woff2",
  "images/logo.png",
  "images/favicon.png",
  "data/settings.json"
];
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(CORE_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // other sites: leave alone
  if (url.pathname.indexOf("/admin") !== -1) return;  // CMS: leave alone

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, true));
  } else if (url.pathname.indexOf("/data/") !== -1) {
    event.respondWith(networkFirst(request, false));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function saveCopy(request, response) {
  if (response && response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
  }
  return response;
}

function networkFirst(request, isPage) {
  const network = fetch(request).then(function (response) { return saveCopy(request, response); });

  return new Promise(function (resolve, reject) {
    let settled = false;
    function finish(response) {
      if (!settled && response) { settled = true; resolve(response); }
    }

    // Slow connection? Fall back to the saved copy after a few seconds…
    const timer = setTimeout(function () {
      caches.match(request).then(finish);
    }, NETWORK_TIMEOUT_MS);

    network
      .then(function (response) { clearTimeout(timer); finish(response); })
      .catch(function () {
        clearTimeout(timer);
        // …and if the network fails completely, use the saved copy or the offline page.
        caches.match(request)
          .then(function (cached) { return cached || (isPage ? caches.match("offline.html") : null); })
          .then(function (fallback) {
            if (fallback) finish(fallback);
            else if (!settled) { settled = true; reject(new Error("Offline and not cached")); }
          });
      });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    const refresh = fetch(request)
      .then(function (response) { return saveCopy(request, response); })
      .catch(function () { return cached; });
    return cached || refresh;
  });
}
