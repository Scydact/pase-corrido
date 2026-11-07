<script setup lang="ts">
import type { Section } from '../useNav'

defineProps<{ name: Section; active: boolean }>()
</script>

<template>
  <svg class="icon" :class="{ active }" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'table'">
      <rect class="body" x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path class="detail-line" d="M9.5 12h5" />
      <circle class="detail" cx="12" cy="7.25" r="1.5" />
      <circle class="detail" cx="12" cy="16.75" r="1.5" />
    </template>
    <template v-else-if="name === 'players'">
      <circle class="body" cx="9" cy="8" r="3.5" />
      <path class="body" d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5z" />
      <path class="stroke" d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.9c2.1.8 3.5 2.5 3.5 5.1" />
    </template>
    <template v-else-if="name === 'count'">
      <rect class="body" x="3.5" y="12" width="4.5" height="8.5" rx="1" />
      <rect class="body" x="9.75" y="3.5" width="4.5" height="17" rx="1" />
      <rect class="body" x="16" y="8" width="4.5" height="12.5" rx="1" />
    </template>
    <template v-else-if="name === 'score'">
      <path class="body" d="M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0z" />
      <path class="stroke" d="M7.5 5.5H4v1.5a3.5 3.5 0 0 0 3.5 3.5M16.5 5.5H20v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20.5h8" />
    </template>
    <template v-else>
      <path class="stroke" d="M3.5 7h7M17.5 7h3M3.5 17h3M13.5 17h7" />
      <circle class="body" cx="14" cy="7" r="3" />
      <circle class="body" cx="10" cy="17" r="3" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Outlined when inactive, filled when active, as Material asks. */
.active .body {
  fill: currentColor;
}

.detail {
  fill: currentColor;
  stroke: none;
}

.active .detail {
  fill: var(--accent);
}

.active .detail-line {
  stroke: var(--accent);
}
</style>
