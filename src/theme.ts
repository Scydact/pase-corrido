import { ref, watch, watchEffect } from 'vue'

export interface TileTheme {
  tile: string
  pip: string
  line: string
  border: string
  speck: boolean
  speckColor: string
  speckLight: string
  spinner: boolean
  coloredPips: boolean
  /** Your chosen color per number. Empty means the automatic one. */
  color1: string
  color2: string
  color3: string
  color4: string
  color5: string
  color6: string
}

export type PipColorKey = 'color1' | 'color2' | 'color3' | 'color4' | 'color5' | 'color6'
export const pipColorKey = (n: number) => `color${n}` as PipColorKey

export interface AppTheme {
  bg: string
  fg: string
  accent: string
}

/** A preset only picks the tile's colors. The options below combine with any of them. */
export type TilePreset = Pick<TileTheme, 'tile' | 'pip' | 'line' | 'border'>

export const TILE_PRESETS = {
  classic: { tile: '#f6f1e3', pip: '#1d2522', line: '#b8ae94', border: '#b8ae94' },
  presidente: { tile: '#0b8a50', pip: '#ffffff', line: '#ffffff', border: '#07643a' },
  crimson: { tile: '#a8122f', pip: '#ffffff', line: '#ffffff', border: '#760c21' },
  ultramarine: { tile: '#1f3aa8', pip: '#ffffff', line: '#ffffff', border: '#142674' },
  inverse: { tile: '#141414', pip: '#ffffff', line: '#8a8a8a', border: '#8a8a8a' },
} satisfies Record<string, TilePreset>

export const DEFAULT_TILE_THEME: TileTheme = {
  ...TILE_PRESETS.classic,
  speck: false,
  speckColor: '#55556c',
  speckLight: '#f5f5fa',
  spinner: false,
  coloredPips: false,
  color1: '',
  color2: '',
  color3: '',
  color4: '',
  color5: '',
  color6: '',
}

export const APP_PRESETS = {
  table: { bg: '#12261f', fg: '#f1f5f0', accent: '#f2c14e' },
  night: { bg: '#111418', fg: '#eef1f4', accent: '#f2c14e' },
  wood: { bg: '#2b1c12', fg: '#f5e9da', accent: '#e0a45c' },
  caribbean: { bg: '#0c2a3e', fg: '#eaf6fb', accent: '#2ec4b6' },
  crimson: { bg: '#2c0a13', fg: '#fbeef0', accent: '#ff5c74' },
  ultramarine: { bg: '#0d1440', fg: '#eef0fd', accent: '#7c96ff' },
  light: { bg: '#f3efe6', fg: '#1f2a24', accent: '#0f6e4f' },
} satisfies Record<string, AppTheme>

/**
 * No domino standard fixes a color per number, so this follows a common historical
 * scheme (2 red, 3 green, 4 orange, 5 blue, 6 yellow). Each is darkened or lightened
 * to stay readable on the tile, and 1 keeps the tile's normal pip color.
 */
const COLORED_ON_LIGHT = ['#c62828', '#1b7f3b', '#d9660a', '#1565c0', '#8a6d00']
const COLORED_ON_DARK = ['#ff6b6b', '#5fd38a', '#ffab5c', '#6cb6ff', '#ffe066']

function channels(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

export function mix(a: string, b: string, amount: number) {
  const [from, to] = [channels(a), channels(b)]
  const out = from.map((c, i) => Math.round(c + (to[i] - c) * amount))
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, from 1 (same color) to 21 (black on white). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const isLight = (hex: string) => luminance(hex) > 0.4

/** Moves a color toward the tile's normal pip color until it can be seen on the tile. */
function legibleOn(tile: string, pip: string, color: string) {
  for (let amount = 0; amount <= 1; amount += 0.1) {
    const candidate = mix(color, pip, amount)
    if (contrast(candidate, tile) >= 3) return candidate
  }
  return pip
}

export function tileVars(theme: TileTheme): Record<string, string> {
  const automatic = isLight(theme.tile) ? COLORED_ON_LIGHT : COLORED_ON_DARK
  const pips = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((n) => {
      if (!theme.coloredPips) return [`--pip-${n}`, theme.pip]
      const fallback = n === 1 ? theme.pip : legibleOn(theme.tile, theme.pip, automatic[n - 2])
      return [`--pip-${n}`, theme[pipColorKey(n)] || fallback]
    }),
  )
  return {
    '--tile': theme.tile,
    '--pip': theme.pip,
    ...pips,
    '--tile-line': theme.line,
    '--tile-border': theme.border,
    '--tile-speck': theme.speckColor,
    '--tile-speck-light': theme.speckLight,
    '--speck-display': theme.speck ? 'inline' : 'none',
    '--spinner-display': theme.spinner ? 'inline' : 'none',
  }
}

/** Works out every app color from the three a theme picks, so custom themes stay coherent. */
export function appVars({ bg, fg, accent }: AppTheme): Record<string, string> {
  const light = isLight(bg)
  return {
    '--bg': bg,
    '--panel': mix(bg, fg, 0.07),
    '--panel-2': mix(bg, fg, 0.14),
    '--line': mix(bg, fg, 0.26),
    '--text': fg,
    '--muted': mix(fg, bg, 0.28),
    '--accent': accent,
    '--accent-text': contrast(accent, '#14110a') >= contrast(accent, '#ffffff') ? '#14110a' : '#ffffff',
    '--good': light ? '#1b7a46' : '#7fd8a4',
    '--warn': light ? '#b3321e' : '#ffb4a2',
    'color-scheme': light ? 'light' : 'dark',
  }
}

export function presetIdOf<P extends object>(theme: P, presets: Record<string, P>): string | null {
  const same = (a: P, b: P) => (Object.keys(b) as (keyof P)[]).every((key) => a[key] === b[key])
  return Object.keys(presets).find((id) => same(theme, presets[id])) ?? null
}

const HEX = /^#[0-9a-f]{6}$/i

/** Keeps only saved values of the right type, so a bad entry can't break the app's colors. */
export function sanitize<T extends object>(saved: unknown, fallback: T): T {
  const out = { ...fallback } as Record<string, unknown>
  if (saved && typeof saved === 'object') {
    for (const [key, value] of Object.entries(saved)) {
      const expected = out[key]
      if (typeof expected === 'boolean' && typeof value === 'boolean') out[key] = value
      if (typeof expected === 'string' && typeof value === 'string' && (HEX.test(value) || value === expected)) {
        out[key] = value
      }
    }
  }
  return out as T
}

function persisted<T extends object>(key: string, fallback: T) {
  let initial = fallback
  try {
    initial = sanitize(JSON.parse(localStorage.getItem(key) ?? 'null'), fallback)
  } catch {
    // Use the default.
  }
  const theme = ref({ ...initial })
  watch(
    theme,
    (value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // The theme just won't be remembered.
      }
    },
    { deep: true },
  )
  return theme
}

export const tileTheme = persisted<TileTheme>('domino-helper:tile-theme', DEFAULT_TILE_THEME)
export const appTheme = persisted<AppTheme>('domino-helper:app-theme', APP_PRESETS.table)

export function applyThemes() {
  watchEffect(() => {
    const root = document.documentElement
    const vars = { ...tileVars(tileTheme.value), ...appVars(appTheme.value) }
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appTheme.value.bg)
  })
}
