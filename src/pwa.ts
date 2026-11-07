import { ref } from 'vue'

declare const __APP_VERSION__: string

export const appVersion = __APP_VERSION__
export const offlineReady = ref(false)

const CACHE_PREFIX = 'pase-corrido-'

/** Browsers only allow this on HTTPS or localhost, so a LAN address simply runs without it. */
export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js')
      await navigator.serviceWorker.ready
      offlineReady.value = true
    } catch {
      // The app still works online without it.
    }
  })
}

/**
 * Really asks the server, because the browser's own online flag stays true on Wi-Fi with no
 * internet. The changing query keeps this from being answered by the saved copy.
 */
export async function canReachServer() {
  try {
    const response = await fetch(`./manifest.webmanifest?check=${Date.now()}`, { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Clears the saved app files and reloads a fresh copy. Saved games and settings live
 * elsewhere, so they aren't touched. Needs internet, since nothing is left to open without it.
 */
export async function repairApp() {
  if ('serviceWorker' in navigator) {
    // Other projects share this web origin, so only remove the one for this app's folder.
    const scope = new URL('./', location.href).href
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.filter((r) => r.scope === scope).map((r) => r.unregister()))
  }
  const names = await caches.keys()
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)))
  location.reload()
}
