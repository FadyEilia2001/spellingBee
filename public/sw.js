// Lets the app open without a connection once it has been opened online.
// The page is fetched fresh when online so new deploys show up; everything
// else (hashed scripts, word audio, music) is kept after its first use.
// ponytail: word audio is cached as she hears it, not all 11 MB up front;
// precache the full list here if she needs to study fully offline.
const CACHE = 'spelling-bee-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const page = await fetch('/', { cache: 'no-store' })
      const html = await page.clone().text()
      await cache.put('/', page)
      const linked = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1])
      await cache.addAll([...new Set(linked)])
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin) return
  // Safari's media player asks for byte ranges and won't play a whole cached file back.
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          // Only whole, successful files.
          if (response.status === 200) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
