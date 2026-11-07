<script setup lang="ts">
import { computed } from 'vue'
import { SEATS, type Seat } from '../domain/game'
import { t } from '../i18n'

const props = defineProps<{ turn: Seat | null }>()

const label = computed(() => (props.turn === null ? t('dots.over') : t('dots.turn', { seat: props.turn })))
</script>

<template>
  <div class="dots" role="img" :aria-label="label">
    <span
      v-for="seat in SEATS"
      :key="seat"
      class="dot"
      :class="[`seat-${seat}`, { active: seat === turn }]"
    />
  </div>
</template>

<style scoped>
/* Seen from your chair: you at the bottom, play moving to the right and around. */
.dots {
  position: relative;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
}

.dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--line);
}

.active {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgb(242 193 78 / 30%);
}

.seat-0 {
  left: 16px;
  bottom: 2px;
}

.seat-1 {
  right: 2px;
  top: 16px;
}

.seat-2 {
  left: 16px;
  top: 2px;
}

.seat-3 {
  left: 2px;
  top: 16px;
}
</style>
