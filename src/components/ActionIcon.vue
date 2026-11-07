<script setup lang="ts">
defineProps<{ kind: 'tiles' | 'keypad' | 'paso' | 'grid' | 'pyramid' | 'undo' | 'new' | 'camera' }>()

const KEYS = [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => ({ x, y })))
const GRID = [5, 12, 19].flatMap((y) => [4, 9.3, 14.7, 20].map((x) => ({ x, y })))
const PYRAMID = [
  { x: 12, y: 5 },
  { x: 8, y: 12 },
  { x: 16, y: 12 },
  { x: 4, y: 19 },
  { x: 12, y: 19 },
  { x: 20, y: 19 },
]
</script>

<template>
  <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="kind === 'tiles'">
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path class="cut" d="M9.5 12h5" />
      <circle class="cut-dot" cx="12" cy="7" r="1.5" />
      <circle class="cut-dot" cx="12" cy="17" r="1.5" />
    </template>
    <path v-else-if="kind === 'undo'" class="stroke" d="M8.5 5 4 9.5 8.5 14M4 9.5h10.5a5 5 0 0 1 0 10H11" />
    <path v-else-if="kind === 'new'" class="stroke" d="M12 5v14M5 12h14" />
    <template v-else-if="kind === 'camera'">
      <path d="M4.5 7H8l1.5-2.5h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-10A1.5 1.5 0 0 1 4.5 7z" />
      <circle class="cut-dot" cx="12" cy="13.5" r="3.5" />
    </template>
    <template v-else-if="kind === 'paso'">
      <path d="M4 4.5v15a1 1 0 0 0 1.5.8L17 13.1V19a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-3 0v5.9L5.5 3.7A1 1 0 0 0 4 4.5z" />
    </template>
    <template v-else>
      <circle
        v-for="(dot, i) in kind === 'keypad' ? KEYS : kind === 'grid' ? GRID : PYRAMID"
        :key="i"
        :cx="dot.x"
        :cy="dot.y"
        :r="kind === 'grid' ? 2 : 2.5"
      />
    </template>
  </svg>
</template>

<style scoped>
.action-icon {
  flex: none;
  width: 1.15em;
  height: 1.15em;
  fill: currentColor;
}

.stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cut {
  fill: none;
  stroke: var(--action-cut, var(--panel));
  stroke-width: 2;
  stroke-linecap: round;
}

.cut-dot {
  fill: var(--action-cut, var(--panel));
}
</style>
