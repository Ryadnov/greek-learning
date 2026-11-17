/*
 * Service worker: сайт открывается и работает без интернета.
 *  - страница (index.html) — сначала сеть, без сети — из кэша (так после публикации сразу приходит новая версия);
 *  - JS/CSS (имена с хэшем) — из кэша, при установке кэшируются сразу;
 *  - озвучка — из кэша; mp3 сохраняется при первом прослушивании.
 */
const PAGES = 'pages-v1'
const ASSETS = 'assets-v1'
const AUDIO = 'audio-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch('./', { cache: 'no-store' })
      const html = await res.clone().text()
      await (await caches.open(PAGES)).put('./', res)
      // файлы текущей сборки — сразу в кэш, старые сборки — удаляем
      const urls = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.location).href)
      const assets = await caches.open(ASSETS)
      await assets.addAll(urls)
      for (const req of await assets.keys()) if (!urls.includes(req.url)) await assets.delete(req)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS, AUDIO]
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put('./', res.clone())
    return res
  } catch {
    return (await cache.match('./')) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  const path = new URL(request.url).pathname
  if (request.mode === 'navigate') event.respondWith(networkFirst(request))
  else if (path.includes('/audio/')) event.respondWith(cacheFirst(AUDIO, request))
  else if (path.includes('/assets/') || path.includes('/icons/')) event.respondWith(cacheFirst(ASSETS, request))
})
