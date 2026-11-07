<script setup lang="ts">
import { DARK_SPECKS, LIGHT_SPECKS, PIP_PATTERNS } from '../pips'

defineProps<{ n: number }>()

const coord = (i: number) => 12 + i * 13
const FACE_DARK = DARK_SPECKS.filter(([, y]) => y < 47)
const FACE_LIGHT = LIGHT_SPECKS.filter(([, y]) => y < 47)
</script>

<template>
  <svg class="face" viewBox="0 0 50 50" role="img" :aria-label="String(n)">
    <rect x="2" y="2" width="46" height="46" rx="8" fill="var(--tile)" stroke="currentColor" stroke-width="3" />
    <g style="display: var(--speck-display); opacity: 0.5">
      <circle v-for="([x, y, r], i) in FACE_DARK" :key="i" :cx="x" :cy="y" :r="r" fill="var(--tile-speck)" />
      <circle v-for="([x, y, r], i) in FACE_LIGHT" :key="`l${i}`" :cx="x" :cy="y" :r="r" fill="var(--tile-speck-light)" />
    </g>
    <circle
      v-for="([x, y], i) in PIP_PATTERNS[n]"
      :key="i"
      :cx="coord(x)"
      :cy="coord(y)"
      r="5"
      :fill="`var(--pip-${n})`"
    />
  </svg>
</template>

<style scoped>
.face {
  display: inline-block;
  width: 1.75em;
  height: 1.75em;
  vertical-align: middle;
}
</style>
