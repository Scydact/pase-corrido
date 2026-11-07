<script setup lang="ts">
defineProps<{ kind: 'table' | 'mine' | 'others' }>()
</script>

<template>
  <svg class="count-icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="kind === 'table'">
      <rect x="1.5" y="6" width="21" height="12" rx="3" />
      <path class="cut" d="M12 6v12" />
    </template>
    <template v-else-if="kind === 'mine'">
      <circle cx="12" cy="7.5" r="5" />
      <path d="M3 22c0-5 4-8 9-8s9 3 9 8z" />
    </template>
    <template v-else>
      <circle cx="8.5" cy="8" r="4" />
      <path d="M1 21c0-4.5 3.3-7 7.5-7s7.5 2.5 7.5 7z" />
      <path class="line" d="M15.5 4.5a4 4 0 0 1 0 7M19 14.8c2.4.9 4 3 4 6.2" />
    </template>
  </svg>
</template>

<style scoped>
.count-icon {
  flex: none;
  width: 1em;
  height: 1em;
  fill: currentColor;
}

.cut {
  fill: none;
  stroke: var(--panel);
  stroke-width: 2;
}

.line {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
}
</style>
