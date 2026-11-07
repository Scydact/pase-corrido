import { nextTick } from 'vue'
import { persistedChoice } from './persistedChoice'

export const SECTIONS = ['table', 'players', 'count', 'score', 'settings'] as const
export type Section = (typeof SECTIONS)[number]

export const section = persistedChoice<Section>('domino-helper:section', SECTIONS, 'table')

const scrollPositions = new Map<Section, number>()

/** Switches section, returning to where you left that section's scroll. */
export function goTo(next: Section) {
  if (next === section.value) return
  scrollPositions.set(section.value, window.scrollY)
  section.value = next
  nextTick(() => window.scrollTo(0, scrollPositions.get(next) ?? 0))
}
