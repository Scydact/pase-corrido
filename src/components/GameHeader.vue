<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { lang, t } from '../i18n'
import { useGame } from '../useGame'
import ActionIcon from './ActionIcon.vue'
import PipFace from './PipFace.vue'
import TurnDots from './TurnDots.vue'

const props = defineProps<{ actions: boolean }>()

const game = useGame()
const { state, moves, undo } = game
const g = computed(() => state.value!)

// Labels show only when they fit, which depends on the screen width and the language.
const header = ref<HTMLElement | null>(null)
const iconsOnly = ref(false)

async function fitLabels() {
  iconsOnly.value = false
  await nextTick()
  const el = header.value
  iconsOnly.value = !!el && el.scrollWidth > el.clientWidth
}

let observer: ResizeObserver | undefined
let lastWidth = 0

onMounted(() => {
  fitLabels()
  observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === lastWidth) return
    lastWidth = entry.contentRect.width
    fitLabels()
  })
  if (header.value) observer.observe(header.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch([lang, () => props.actions], fitLabels)

function newHand() {
  if (window.confirm(t('game.confirmDrop'))) {
    game.newHand()
    window.scrollTo(0, 0)
  }
}
</script>

<template>
  <header ref="header" class="top">
    <div class="ends" :aria-label="t('game.openEnds')">
      <PipFace :n="g.ends[0]" />
      <span class="sep">|</span>
      <PipFace :n="g.ends[1]" />
    </div>
    <TurnDots :turn="g.outcome ? null : g.turn" />
    <div v-if="actions" class="top-actions" :class="{ 'icons-only': iconsOnly }">
      <button class="btn btn-icon" :disabled="moves.length === 0" :aria-label="t('game.undo')" @click="undo">
        <ActionIcon kind="undo" />
        <span class="label">{{ t('game.undo') }}</span>
      </button>
      <button class="btn btn-icon" :aria-label="t('game.new')" @click="newHand">
        <ActionIcon kind="new" />
        <span class="label">{{ t('game.new') }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: calc(10px + env(safe-area-inset-top)) 0 10px;
  background: var(--bg);
}

.ends {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1.375rem;
  color: var(--accent);
}

.sep {
  font-size: 1.5rem;
  color: var(--line);
}

.top-actions {
  display: flex;
  gap: 6px;
}

.top-actions .btn {
  padding: 8px;
}

.icons-only .label {
  display: none;
}

.icons-only .btn {
  min-width: 44px;
}
</style>
