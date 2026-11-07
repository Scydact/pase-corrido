import type { Msg } from './domain/messages'
import type { Seat } from './domain/game'
import { en, type MessageKey } from './locales/en'
import { es } from './locales/es'
import { persistedChoice } from './persistedChoice'

export const LANGS = ['es', 'en'] as const
export type Lang = (typeof LANGS)[number]
export const LANG_NAMES: Record<Lang, string> = { es: 'Español', en: 'English' }

const dictionaries: Record<Lang, Record<string, string>> = { en, es }

export const lang = persistedChoice<Lang>('domino-helper:lang', LANGS, 'es')

function templateFor(language: Lang, key: MessageKey, params: Msg['params'] = {}) {
  const dictionary = dictionaries[language]
  return (params.seat === 0 && dictionary[`${key}@you`]) || dictionary[key]
}

function fill(language: Lang, template: string, params: Msg['params'] = {}) {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (name === 'seat') return dictionaries[language][`seat.${params.seat}`]
    const value = params[name]
    return Array.isArray(value) ? value.join(', ') : String(value)
  })
}

export function translate(language: Lang, key: MessageKey, params: Msg['params'] = {}): string {
  return fill(language, templateFor(language, key, params), params)
}

export type TextPart = { text: string } | { slot: string }

/** Splits a translation at the named placeholders, so a template can draw something there. */
export function translateParts(
  language: Lang,
  key: MessageKey,
  slots: string[],
  params: Msg['params'] = {},
): TextPart[] {
  const pattern = new RegExp(`(\\{(?:${slots.join('|')})\\})`)
  return templateFor(language, key, params)
    .split(pattern)
    .filter((piece) => piece !== '')
    .map((piece) => {
      const slot = slots.find((name) => piece === `{${name}}`)
      return slot ? { slot } : { text: fill(language, piece, params) }
    })
}

/** Reads the current language, so a template using it updates when the language changes. */
export const t = (key: MessageKey, params?: Msg['params']) => translate(lang.value, key, params)
export const tm = (msg: Msg) => t(msg.key, msg.params)
export const tParts = (key: MessageKey, slots: string[], params?: Msg['params']) =>
  translateParts(lang.value, key, slots, params)
export const seatName = (seat: Seat) => t(`seat.${seat}`)
