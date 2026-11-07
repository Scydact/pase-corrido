<script setup lang="ts">
import { computed } from 'vue'
import { DARK_SPECKS, LIGHT_SPECKS, PIP_PATTERNS } from '../pips'

const props = defineProps<{ a: number; b: number; horizontal?: boolean }>()

const coord = (i: number) => 12 + i * 13

const dots = computed(() => [
  ...PIP_PATTERNS[props.a].map(([x, y]) => ({ x: coord(x), y: coord(y), n: props.a })),
  ...PIP_PATTERNS[props.b].map(([x, y]) => ({ x: coord(x), y: 50 + coord(y), n: props.b })),
])
</script>

<template>
  <svg
    class="domino"
    :class="{ horizontal }"
    :viewBox="horizontal ? '0 0 100 50' : '0 0 50 100'"
    role="img"
    :aria-label="`${a}:${b}`"
  >
    <g :transform="horizontal ? 'rotate(-90) translate(-50 0)' : undefined">
      <rect x="1" y="1" width="48" height="98" rx="7" fill="var(--tile)" stroke="var(--tile-border)" stroke-width="2" />
      <g style="display: var(--speck-display); opacity: 0.5">
        <circle v-for="([x, y, r], i) in DARK_SPECKS" :key="i" :cx="x" :cy="y" :r="r" fill="var(--tile-speck)" />
        <circle v-for="([x, y, r], i) in LIGHT_SPECKS" :key="`l${i}`" :cx="x" :cy="y" :r="r" fill="var(--tile-speck-light)" />
      </g>
      <line x1="7" y1="50" x2="43" y2="50" stroke="var(--tile-line)" stroke-width="2" />
      <g style="display: var(--spinner-display)">
        <circle cx="25" cy="50" r="3.6" fill="#c9a45c" stroke="#7d6330" stroke-width="0.8" />
        <circle cx="24.2" cy="49.2" r="1.2" fill="#f0dfb0" />
      </g>
      <circle v-for="(d, i) in dots" :key="i" :cx="d.x" :cy="d.y" r="4.6" :fill="`var(--pip-${d.n})`" />
    </g>
  </svg>
</template>

<style scoped>
.domino {
  display: block;
  width: 100%;
  max-width: 44px;
  height: auto;
}

.horizontal {
  max-width: 64px;
}
</style>
