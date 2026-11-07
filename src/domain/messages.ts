import type { MessageKey } from '../locales/en'

/** Text the game logic wants to show, kept as a key so it can display in any language. */
export interface Msg {
  key: MessageKey
  params?: Record<string, string | number | (string | number)[]>
}
