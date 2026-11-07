<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../i18n'
import type { MessageKey } from '../locales/en'
import {
  APP_PRESETS,
  appTheme,
  appVars,
  contrast,
  pipColorKey,
  presetIdOf,
  TILE_PRESETS,
  tileTheme,
  tileVars,
  type AppTheme,
  type TilePreset,
} from '../theme'
import DominoTile from './DominoTile.vue'
import PipFace from './PipFace.vue'

const tilePresets = TILE_PRESETS as Record<string, TilePreset>
const appPresets = APP_PRESETS as Record<string, AppTheme>

const tileLabel = (id: string) => t(`theme.tile.${id}` as MessageKey)
const appLabel = (id: string) => t(`theme.app.${id}` as MessageKey)

const activeTile = computed(() => presetIdOf(tileTheme.value, tilePresets))
const activeApp = computed(() => presetIdOf(appTheme.value, appPresets))

const lowTileContrast = computed(() => contrast(tileTheme.value.tile, tileTheme.value.pip) < 3)
const lowAppContrast = computed(() => contrast(appTheme.value.bg, appTheme.value.fg) < 4.5)

const OPTIONS = [
  { key: 'speck', label: 'theme.speck', a: 6, b: 3 },
  { key: 'spinner', label: 'theme.spinner', a: 6, b: 3 },
  { key: 'coloredPips', label: 'theme.coloredPips', a: 5, b: 3 },
] as const

/** Each option's card shows only its own effect, on the current tile colors. */
function optionPreview(key: (typeof OPTIONS)[number]['key']) {
  return tileVars({ ...tileTheme.value, speck: false, spinner: false, coloredPips: false, [key]: true })
}

const effectiveColor = (n: number) => tileVars(tileTheme.value)[`--pip-${n}`]
const NUMBERS = [1, 2, 3, 4, 5, 6]
const hasCustomDots = computed(() => NUMBERS.some((n) => tileTheme.value[pipColorKey(n)] !== ''))
const lowDotContrast = computed(() => NUMBERS.some((n) => contrast(effectiveColor(n), tileTheme.value.tile) < 3))

function resetDots() {
  NUMBERS.forEach((n) => (tileTheme.value[pipColorKey(n)] = ''))
}

function chooseTile(id: string) {
  tileTheme.value = { ...tileTheme.value, ...tilePresets[id] }
}

function chooseApp(id: string) {
  appTheme.value = { ...appPresets[id] }
}
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('theme.tiles') }}</h2>
      <span class="muted">{{ activeTile ? tileLabel(activeTile) : t('theme.custom') }}</span>
    </div>
    <div class="presets">
      <button
        v-for="(preset, id) in tilePresets"
        :key="id"
        class="preset"
        :class="{ active: activeTile === id }"
        :aria-pressed="activeTile === id"
        :style="tileVars({ ...tileTheme, ...preset })"
        @click="chooseTile(String(id))"
      >
        <span class="preset-tile"><DominoTile :a="6" :b="3" horizontal /></span>
        <span class="preset-name">{{ tileLabel(String(id)) }}</span>
      </button>
    </div>

    <div class="options">
      <button
        v-for="option in OPTIONS"
        :key="option.key"
        class="option"
        :class="{ on: tileTheme[option.key] }"
        :aria-pressed="tileTheme[option.key]"
        :style="optionPreview(option.key)"
        @click="tileTheme[option.key] = !tileTheme[option.key]"
      >
        <span class="option-tile"><DominoTile :a="option.a" :b="option.b" horizontal /></span>
        <span class="option-name">{{ t(option.label) }}</span>
      </button>
    </div>

    <div v-if="tileTheme.speck" class="sub-options">
      <label class="row">
        {{ t('theme.speckColor') }}
        <input v-model="tileTheme.speckColor" type="color" />
      </label>
      <label class="row">
        {{ t('theme.speckLight') }}
        <input v-model="tileTheme.speckLight" type="color" />
      </label>
    </div>

    <div v-if="tileTheme.coloredPips" class="sub-options">
      <p class="muted sub-title">{{ t('theme.dotColors') }}</p>
      <div class="pip-colors">
        <label v-for="n in [1, 2, 3, 4, 5, 6]" :key="n" class="pip-color">
          <PipFace :n="n" class="pip-color-face" />
          <input
            type="color"
            :value="effectiveColor(n)"
            :aria-label="t('theme.numberColor', { n })"
            @input="tileTheme[pipColorKey(n)] = ($event.target as HTMLInputElement).value"
          />
        </label>
      </div>
      <button v-if="hasCustomDots" class="btn btn-wide reset" @click="resetDots">{{ t('theme.resetDots') }}</button>
      <p v-if="lowDotContrast" class="warn note">{{ t('theme.lowDotContrast') }}</p>
    </div>

    <details>
      <summary>{{ t('theme.customize') }}</summary>
      <label class="row">
        {{ t('theme.tileColor') }}
        <input v-model="tileTheme.tile" type="color" />
      </label>
      <label class="row">
        {{ t('theme.pipColor') }}
        <input v-model="tileTheme.pip" type="color" />
      </label>
      <label class="row">
        {{ t('theme.lineColor') }}
        <input v-model="tileTheme.line" type="color" />
      </label>
      <label class="row">
        {{ t('theme.borderColor') }}
        <input v-model="tileTheme.border" type="color" />
      </label>
      <p v-if="lowTileContrast" class="warn note">{{ t('theme.lowTileContrast') }}</p>
    </details>
  </section>

  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('theme.app') }}</h2>
      <span class="muted">{{ activeApp ? appLabel(activeApp) : t('theme.custom') }}</span>
    </div>
    <div class="presets">
      <button
        v-for="(preset, id) in appPresets"
        :key="id"
        class="preset app-preset"
        :class="{ active: activeApp === id }"
        :aria-pressed="activeApp === id"
        :style="appVars(preset)"
        @click="chooseApp(String(id))"
      >
        <span class="swatch"><span class="swatch-accent" /></span>
        <span class="preset-name">{{ appLabel(String(id)) }}</span>
      </button>
    </div>

    <details>
      <summary>{{ t('theme.customize') }}</summary>
      <label class="row">
        {{ t('theme.background') }}
        <input v-model="appTheme.bg" type="color" />
      </label>
      <label class="row">
        {{ t('theme.foreground') }}
        <input v-model="appTheme.fg" type="color" />
      </label>
      <label class="row">
        {{ t('theme.accent') }}
        <input v-model="appTheme.accent" type="color" />
      </label>
      <p v-if="lowAppContrast" class="warn note">{{ t('theme.lowAppContrast') }}</p>
    </details>
  </section>
</template>

<style scoped>
.presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 72px;
  padding: 8px 4px;
  background: var(--panel-2);
  border: 2px solid transparent;
  border-radius: 10px;
}

.preset.active {
  border-color: var(--accent);
}

.preset-tile {
  width: 56px;
}

.preset-name {
  font-size: 0.8rem;
  line-height: 1.15;
  text-align: center;
}

/* The app swatches show their own theme's colors, whatever the current theme is. */
.app-preset {
  background: var(--bg);
  color: var(--text);
  outline: 1px solid var(--line);
}

.swatch {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  width: 56px;
  height: 28px;
  padding: 4px;
  background: var(--panel-2);
  border-radius: 6px;
}

.swatch-accent {
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
}

details {
  margin-top: 10px;
}

summary {
  min-height: 28px;
  cursor: pointer;
}

.options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 72px;
  padding: 8px 4px;
  background: none;
  border: 2px solid var(--line);
  border-radius: 10px;
  color: var(--muted);
}

.option.on {
  background: var(--panel-2);
  border-color: var(--accent);
  color: var(--text);
}

.option-tile {
  width: 56px;
}

.option-name {
  font-size: 0.8rem;
  line-height: 1.15;
  text-align: center;
}

.sub-options {
  margin-top: 8px;
}

.sub-title {
  margin: 0 0 6px;
}

.pip-colors {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}

.pip-color {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--tile-border);
}

.pip-color-face {
  font-size: 0.875rem;
}

.pip-color input[type='color'] {
  width: 100%;
  max-width: 48px;
  height: 36px;
}

.reset {
  margin-top: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 44px;
}

input[type='color'] {
  width: 56px;
  height: 36px;
  padding: 2px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.note {
  margin: 8px 0 0;
  font-size: 0.875rem;
}
</style>
