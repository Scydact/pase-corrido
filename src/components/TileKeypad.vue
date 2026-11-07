<script setup lang="ts">
import { ref } from 'vue'
import { NUMBERS, tileId, type TileId } from '../domain/tiles'
import { t } from '../i18n'
import PipFace from './PipFace.vue'

const props = defineProps<{ available: (id: TileId) => boolean }>()
const emit = defineEmits<{ pick: [id: TileId] }>()

const first = ref<number | null>(null)

function enabled(n: number) {
  if (first.value === null) return NUMBERS.some((other) => props.available(tileId(n, other)))
  return props.available(tileId(first.value, n))
}

function press(n: number) {
  if (first.value === null) {
    first.value = n
  } else {
    const id = tileId(first.value, n)
    first.value = null
    emit('pick', id)
  }
}
</script>

<template>
  <div class="keypad">
    <p class="entry" aria-live="polite">
      <PipFace v-if="first !== null" :n="first" class="first-face" />
      <span v-else class="empty">–</span>
      <span class="colon">:</span>
      <span class="empty">–</span>
    </p>
    <div class="keys">
      <button v-for="n in [1, 2, 3, 4, 5, 6]" :key="n" class="btn key" :disabled="!enabled(n)" @click="press(n)">
        {{ n }}
      </button>
      <span />
      <button class="btn key" :disabled="!enabled(0)" @click="press(0)">0</button>
      <button class="btn key" :disabled="first === null" :aria-label="t('keypad.clear')" @click="first = null">⌫</button>
    </div>
  </div>
</template>

<style scoped>
.entry {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 1.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.first-face {
  font-size: 1rem;
}

.empty,
.colon {
  color: var(--muted);
}

.keys {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.key {
  min-height: 52px;
  font-size: 1.4rem;
  font-weight: 600;
}
</style>
