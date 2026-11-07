<script setup lang="ts">
import { t } from '../i18n'
import { goTo, section, SECTIONS } from '../useNav'
import NavIcon from './NavIcon.vue'
</script>

<template>
  <nav class="bar">
    <button
      v-for="item in SECTIONS"
      :key="item"
      class="item"
      :class="{ active: section === item }"
      :aria-current="section === item ? 'page' : undefined"
      @click="goTo(item)"
    >
      <span class="indicator"><NavIcon :name="item" :active="section === item" /></span>
      <span class="label">{{ t(`nav.${item}`) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 6px max(4px, calc((100% - 560px) / 2)) calc(6px + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--line);
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--muted);
}

.indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 56px;
  height: 30px;
  border-radius: 15px;
}

.active .indicator {
  background: var(--accent);
  color: var(--accent-text);
}

.label {
  font-size: 0.75rem;
  white-space: nowrap;
}

.active .label {
  color: var(--text);
  font-weight: 600;
}
</style>
