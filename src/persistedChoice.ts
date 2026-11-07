import { ref, watch, type Ref } from 'vue'

/** A setting this device remembers. It falls back to the default if storage is unavailable. */
export function persistedChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): Ref<T> {
  let initial = fallback
  try {
    const stored = localStorage.getItem(key)
    if (allowed.includes(stored as T)) initial = stored as T
  } catch {
    // Use the default.
  }
  const choice = ref(initial) as Ref<T>
  watch(choice, (value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // The choice just won't be remembered.
    }
  })
  return choice
}
