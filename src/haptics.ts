import { computed } from 'vue'
import { persistedChoice } from './persistedChoice'

const BUZZ_MS = 10
const CONTROLS = 'button:not(:disabled), summary, select, input[type="checkbox"], input[type="radio"]'

const setting = persistedChoice('domino-helper:vibration', ['on', 'off'] as const, 'on')

/** iPhones have no vibration API, so the setting is only offered where it can work. */
export const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator

export const vibrationOn = computed({
  get: () => setting.value === 'on',
  set: (on: boolean) => {
    setting.value = on ? 'on' : 'off'
  },
})

/** Gives every control a light tap from one listener, so new buttons get it automatically. */
export function enableHaptics() {
  if (!canVibrate) return
  document.addEventListener(
    'click',
    (event) => {
      if (vibrationOn.value && (event.target as Element).closest?.(CONTROLS)) navigator.vibrate(BUZZ_MS)
    },
    { capture: true },
  )
}
