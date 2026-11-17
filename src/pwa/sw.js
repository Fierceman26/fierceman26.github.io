/* FIERCEMAN · JOURNAL
   Documents are network-first, so a GitHub Pages deploy is picked up on the
   next online visit instead of pinning the shell. Already-opened pages stay in
   journal-pages across deploys and are what offline reading serves.
   Hashed /_astro files are cache-first. RSS stays network-first and is never
   replaced with HTML. Non-GET requests (including FormSubmit comment POSTs)
   are not intercepted. */

const BUILD_ID = '__BUILD_ID__';
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const PAGES = 'journal-pages';
const STATIC = 'journal-static';
const PRECACHE_PAGES = ['/', '/en/', '/offline.html'];

self.__JOURNAL_BUILD__ = BUILD_ID;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    const assets = await caches.open(STATIC);
    await pages.addAll(PRECACHE_PAGES);
    if (PRECACHE_ASSETS.length) await assets.addAll(PRECACHE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('journal-') && key !== PAGES && key !== STATIC)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function isRss(pathname) {
  return pathname === '/rss.xml' || pathname === '/en/rss.xml';
}

function isDocument(pathname) {
  if (isRss(pathname)) return false;
  if (pathname === '/sw.js' || pathname === '/manifest.webmanifest') return false;
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/icons/') || pathname.startsWith('/images/')) {
    return false;
  }
  if (/\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|xml|txt|map|json|webmanifest)$/i.test(pathname)) {
    return false;
  }
  return true;
}

function documentKey(url) {
  let path = url.pathname;
  if (!path.endsWith('.html') && !/\.[a-z0-9]+$/i.test(path) && !path.endsWith('/')) path += '/';
  return url.origin + path;
}

async function store(cache, key, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  if (response.redirected) {
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    const body = await response.blob();
    await cache.put(key, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
    return;
  }
  await cache.put(key, response);
}

async function networkFirst(request, key) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await store(cache, key, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const pending = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const response = await pending;
  if (response) return response;
  throw new Error('offline');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (isRss(url.pathname)) {
    event.respondWith(networkFirst(request, url.origin + url.pathname));
    return;
  }

  if (isDocument(url.pathname)) {
    event.respondWith((async () => {
      try {
        return await networkFirst(request, documentKey(url));
      } catch (err) {
        if (request.mode === 'navigate') {
          const cache = await caches.open(PAGES);
          const offline = await cache.match('/offline.html');
          if (offline) return offline;
        }
        throw err;
      }
    })());
    return;
  }

  const immutable = url.pathname.startsWith('/_astro/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/favicon.svg'
    || url.pathname === '/apple-touch-icon.png';

  event.respondWith(immutable ? cacheFirst(request) : staleWhileRevalidate(request));
});
