<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SEATS, type Seat } from '../domain/game'
import { ALL_TILES, NUMBERS, parseTile, type TileId } from '../domain/tiles'
import { seatName, t } from '../i18n'
import type { MessageKey } from '../locales/en'
import { persistedChoice } from '../persistedChoice'
import type { TileReading } from '../vision/detect'
import { useGame } from '../useGame'
import ActionIcon from './ActionIcon.vue'
import DominoTile from './DominoTile.vue'
import PhotoReader from './PhotoReader.vue'
import TileKeypad from './TileKeypad.vue'

const game = useGame()

const step = ref<1 | 2>(1)
const hand = ref<TileId[]>([])
const startTile = ref<TileId | null>(null)
const starter = ref<Seat | null>(null)

const LAYOUTS = ['grid', 'pyramid', 'keypad'] as const
const LAYOUT_LABELS: Record<(typeof LAYOUTS)[number], MessageKey> = {
  grid: 'setup.grid',
  pyramid: 'setup.pyramid',
  keypad: 'setup.keypad',
}
const layout = persistedChoice('domino-helper:hand-layout', LAYOUTS, 'grid')

const handRows = computed(() =>
  layout.value === 'pyramid'
    ? NUMBERS.map((hi) => ALL_TILES.filter((t) => t.hi === hi).reverse())
    : [ALL_TILES],
)

const tooManyInPhoto = ref(false)

function handFromPhoto(readings: TileReading[]) {
  const unique = [...new Set(readings.map((r) => r.id))]
  tooManyInPhoto.value = unique.length > 7
  if (unique.length > 0) hand.value = unique.slice(0, 7)
}

function toggleHand(id: TileId) {
  if (hand.value.includes(id)) hand.value = hand.value.filter((t) => t !== id)
  else if (hand.value.length < 7) hand.value = [...hand.value, id]
}

const canAddToHand = (id: TileId) => hand.value.length < 7 && !hand.value.includes(id)
const handTiles = computed(() => hand.value.map(parseTile))

const startParts = computed(() => (startTile.value ? parseTile(startTile.value) : null))
const holdsStart = computed(() => startTile.value !== null && hand.value.includes(startTile.value))

// Only you can have played a tile from your hand, and only that one if you opened.
watch(startTile, () => {
  if (holdsStart.value) starter.value = 0
  else if (starter.value === 0) starter.value = null
})

function goToStart() {
  if (hand.value.includes('6:6')) startTile.value = '6:6'
  step.value = 2
}

const seatDisabled = (seat: Seat) => (holdsStart.value ? seat !== 0 : seat === 0)
const canStart = computed(() => startTile.value !== null && starter.value !== null)

function start() {
  if (startTile.value === null || starter.value === null) return
  game.start({ hand: hand.value, startTile: startTile.value, starter: starter.value, rules: { ...game.rules.value } })
}
</script>

<template>
  <header class="head">
    <h1>{{ t('app.title') }}</h1>
    <p class="muted">{{ t('setup.step', { step }) }}</p>
  </header>

  <section v-if="step === 1" class="panel">
    <div class="panel-title">
      <h2>{{ t('setup.yourTiles') }}</h2>
      <span class="muted">{{ t('setup.count', { n: hand.length }) }}</span>
    </div>
    <div class="layout-switch">
      <button
        v-for="option in LAYOUTS"
        :key="option"
        class="btn btn-icon"
        :class="{ 'btn-primary': layout === option }"
        :aria-pressed="layout === option"
        @click="layout = option"
      >
        <ActionIcon :kind="option" />
        {{ t(LAYOUT_LABELS[option]) }}
      </button>
    </div>
    <div class="photo">
      <PhotoReader label="photo.takeHand" @read="handFromPhoto" />
      <p v-if="tooManyInPhoto" class="warn too-many">{{ t('photo.extra') }}</p>
    </div>
    <template v-if="layout === 'keypad'">
      <TileKeypad :available="canAddToHand" @pick="toggleHand" />
      <p v-if="hand.length" class="muted picked-note">{{ t('setup.removeHint') }}</p>
      <div class="tile-grid">
        <button v-for="tile in handTiles" :key="tile.id" class="tile-btn selected" @click="toggleHand(tile.id)">
          <DominoTile :a="tile.hi" :b="tile.lo" />
        </button>
      </div>
    </template>
    <template v-else>
      <div v-for="(row, i) in handRows" :key="i" :class="layout === 'pyramid' ? 'pyramid-row' : 'tile-grid'">
        <button
          v-for="tile in row"
          :key="tile.id"
          class="tile-btn"
          :class="{ selected: hand.includes(tile.id) }"
          :disabled="hand.length === 7 && !hand.includes(tile.id)"
          :aria-pressed="hand.includes(tile.id)"
          @click="toggleHand(tile.id)"
        >
          <DominoTile :a="tile.hi" :b="tile.lo" />
        </button>
      </div>
    </template>
    <button class="btn btn-primary btn-wide next" :disabled="hand.length !== 7" @click="goToStart">
      {{ t('setup.next') }}
    </button>
  </section>

  <template v-else>
    <section class="panel">
      <div class="panel-title">
        <h2>{{ t('setup.startTile') }}</h2>
        <span v-if="startTile" class="chosen-tile"><DominoTile :a="startParts!.hi" :b="startParts!.lo" horizontal /></span>
        <span v-else class="muted">{{ t('setup.pickOne') }}</span>
      </div>
      <TileKeypad v-if="layout === 'keypad'" :available="() => true" @pick="startTile = $event" />
      <div v-else class="tile-grid">
        <button
          v-for="tile in ALL_TILES"
          :key="tile.id"
          class="tile-btn"
          :class="{ selected: startTile === tile.id }"
          :aria-pressed="startTile === tile.id"
          @click="startTile = tile.id"
        >
          <DominoTile :a="tile.hi" :b="tile.lo" />
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">
        <h2>{{ t('setup.whoPlayed') }}</h2>
        <span v-if="holdsStart" class="muted">{{ t('setup.inHand') }}</span>
      </div>
      <div class="seats">
        <button
          v-for="seat in SEATS"
          :key="seat"
          class="btn"
          :class="{ 'btn-primary': starter === seat }"
          :disabled="seatDisabled(seat)"
          @click="starter = seat"
        >
          {{ seatName(seat) }}
        </button>
      </div>
    </section>

    <div class="actions">
      <button class="btn" @click="step = 1">{{ t('setup.back') }}</button>
      <button class="btn btn-primary grow" :disabled="!canStart" @click="start">{{ t('setup.startHand') }}</button>
    </div>
  </template>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: calc(14px + env(safe-area-inset-top));
}

.head p {
  margin: 0;
}

.next {
  margin-top: 12px;
}

.layout-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.layout-switch .btn {
  padding: 8px 2px;
}

.chosen-tile {
  width: 44px;
}

.photo {
  margin-bottom: 10px;
}

.too-many {
  margin: 8px 0 0;
  font-size: 0.875rem;
}

.picked-note {
  margin: 10px 0 6px;
}

/* Tiles stay the same width as in the grid, so each row sits centered under the last. */
.pyramid-row {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.pyramid-row + .pyramid-row {
  margin-top: 6px;
}

.pyramid-row .tile-btn {
  flex: 0 0 calc((100% - 36px) / 7);
}

.seats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.seats .btn {
  padding: 8px 2px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.grow {
  flex: 1;
}
</style>
