// The offline layer. The build fills in the two values below and publishes this as sw.js.
//
// Policy: online, opening the app gets the latest page. Offline or on a very slow network,
// it gets the last complete set saved here. It never reloads a page by itself, so nothing
// changes in the middle of a hand.
const VERSION = '__VERSION__'
const FILES = __FILES__

const PREFIX = 'pase-corrido-'
const CACHE = PREFIX + VERSION
const PAGE = new URL('./', self.location).href
const NETWORK_WAIT_MS = 3000

// Saves the whole set before taking over, so a failed download leaves the old version working.
// 'reload' skips the browser's own cache, which could mix an old page into the new set.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        await cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))
      } catch (error) {
        // An empty leftover would count as the "previous set" and push out the real one.
        await caches.delete(CACHE)
        throw error
      }
      await self.skipWaiting()
    })(),
  )
})

// Keeps the previous set too: a page still open on the old version may yet ask for its files.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== CACHE)
      await Promise.all(names.slice(0, -1).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

async function latestPage() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_WAIT_MS)
  try {
    // 'no-cache' asks the server each time, so a new release isn't hidden by the browser's cache.
    const response = await fetch(PAGE, { cache: 'no-cache', signal: controller.signal })
    if (response.ok) return response
  } catch {
    // Offline or too slow, so the saved page below is the answer.
  } finally {
    clearTimeout(timer)
  }
  const saved = (await caches.open(CACHE).then((cache) => cache.match(PAGE))) ?? (await caches.match(PAGE))
  return saved ?? fetch(PAGE)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return
  if (request.mode === 'navigate') {
    event.respondWith(latestPage())
    return
  }
  // Everything else has a versioned name or never changes, so a saved copy is always right.
  event.respondWith(caches.match(request).then((saved) => saved ?? fetch(request)))
})
