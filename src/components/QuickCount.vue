<script setup lang="ts">
import { computed } from 'vue'
import { numberCounts } from '../domain/game'
import { t } from '../i18n'
import { useGame } from '../useGame'
import CountIcon from './CountIcon.vue'
import PipFace from './PipFace.vue'

const { state } = useGame()

const counts = computed(() => numberCounts(state.value!))
const isOpen = (n: number) => state.value!.ends.includes(n)
</script>

<template>
  <section class="panel quick" :aria-label="t('quick.title')">
    <div
      v-for="c in counts"
      :key="c.number"
      class="column"
      :class="{ open: isOpen(c.number) }"
      role="group"
      :aria-label="`${c.number}: ${t('quick.line', { table: c.played, mine: c.mine, others: c.others })}`"
    >
      <PipFace :n="c.number" class="column-face" aria-hidden="true" />
      <div class="counts" aria-hidden="true">
        <span class="count" :class="{ zero: c.played === 0 }">
          <CountIcon kind="table" class="icon" />
          {{ c.played }}
        </span>
        <span class="count" :class="{ zero: c.mine === 0 }">
          <CountIcon kind="mine" class="icon" />
          {{ c.mine }}
        </span>
        <span class="count others" :class="{ zero: c.others === 0 }">
          <CountIcon kind="others" class="icon" />
          {{ c.others }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quick {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  padding: 8px 6px;
}

.column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--tile-border);
}

.column.open {
  color: var(--accent);
}

.column-face {
  font-size: 1.0625rem;
}

.counts {
  display: flex;
  flex-direction: column;
  gap: 1px;
  color: var(--text);
}

.count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.8125rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.icon {
  font-size: 11px;
  color: var(--muted);
}

.others {
  font-weight: 700;
}

.zero {
  color: var(--muted);
  font-weight: 400;
}

.zero .icon {
  opacity: 0.6;
}
</style>
