<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { canPlay, forcedPasses, placeOn, placements, type Side } from '../domain/game'
import { passChance } from '../domain/inference'
import { bestCapicuaPlay } from '../domain/suggest'
import { parseTile, type Tile, type TileId } from '../domain/tiles'
import { t, tm } from '../i18n'
import type { Msg } from '../domain/messages'
import { persistedChoice } from '../persistedChoice'
import { useGame } from '../useGame'
import ActionIcon from './ActionIcon.vue'
import DominoTile from './DominoTile.vue'
import RichText from './RichText.vue'
import TileKeypad from './TileKeypad.vue'

const { state, hidden, analysis, suggestions, partner, play, pass, passAll } = useGame()

const pct = (p: number) => Math.round(p * 100)

const capicuaPlay = computed(() => bestCapicuaPlay(suggestions.value))

const capicuaDetail = computed(() => {
  const best = capicuaPlay.value
  if (!best) return ''
  const parts = []
  if (best.capicua.mine > 0) parts.push(t('entry.capicuaYou', { pct: pct(best.capicua.mine) }))
  if (best.capicua.partner > 0) parts.push(t('entry.capicuaPartner', { pct: pct(best.capicua.partner) }))
  return parts.join(', ')
})

const partnerFacts = computed(() => {
  const p = partner.value
  if (!p) return []
  const facts: { msg: Msg; cls: string }[] = []
  if (p.lacks.length) facts.push({ msg: { key: 'read.no', params: { nums: p.lacks } }, cls: 'warn' })
  if (p.has.length) facts.push({ msg: { key: 'read.has', params: { tiles: p.has.map((tile) => tile.id) } }, cls: 'good' })
  if (p.likely.length) facts.push({ msg: { key: 'read.likely', params: { nums: p.likely } }, cls: '' })
  return facts
})

const seat = computed(() => state.value!.turn)
const ends = computed(() => state.value!.ends)
const isMine = computed(() => seat.value === 0)
const pending = ref<Tile | null>(null)

watch(() => state.value?.log.length, () => (pending.value = null))

const read = computed(() => analysis.value?.reads.find((r) => r.seat === seat.value))

const options = computed(() =>
  state.value!.unseen
    .filter((tile) => canPlay(tile, ends.value))
    .map((tile) => ({ tile, p: read.value?.odds.get(tile.id) ?? 0 }))
    .sort((a, b) => b.p - a.p),
)

const moveInput = persistedChoice('domino-helper:move-input', ['tiles', 'keypad'] as const, 'tiles')
const isOption = (id: TileId) => options.value.some((o) => o.tile.id === id)

const passP = computed(() => (isMine.value ? 0 : passChance(hidden.value!, seat.value, [...new Set(ends.value)])))

function choose(tile: Tile) {
  const sides = placements(tile, ends.value)
  if (sides.length > 1) pending.value = tile
  else place(tile, sides[0])
}

function place(tile: Tile, side: Side) {
  play(seat.value, tile.id, side)
}

const forced = computed(() => forcedPasses(state.value!))

const endsAfter = (tile: Tile, side: Side) => placeOn(tile, side, ends.value)
const noTileMsg = computed((): Msg => {
  const [a, b] = ends.value
  return a === b ? { key: 'entry.noTileOne', params: { pip: a } } : { key: 'entry.noTile', params: { a, b } }
})
</script>

<template>
  <section class="panel entry">
    <!-- Your turn: the ranked legal plays double as the buttons to play them. -->
    <template v-if="isMine">
      <div class="panel-title">
        <h2>{{ t('entry.yourTurn') }}</h2>
        <span class="muted">{{ t('entry.bestFirst') }}</span>
      </div>
      <p v-if="partnerFacts.length" class="summary">
        <strong>{{ t('entry.partner') }}</strong>{{ ' ' }}
        <span v-for="f in partnerFacts" :key="f.msg.key" :class="f.cls"><RichText :msg="f.msg" />.{{ ' ' }}</span>
      </p>
      <p v-if="capicuaPlay" class="summary">
        <strong>{{ t('entry.bestCapicua') }}</strong>{{ ' ' }}
        <RichText
          :msg="{
            key: 'entry.capicuaLine',
            params: {
              tile: capicuaPlay.tile.id,
              ends: capicuaPlay.ends,
              pct: pct(capicuaPlay.capicua.mine + capicuaPlay.capicua.partner),
              detail: capicuaDetail,
            },
          }"
        />
      </p>
      <button
        v-for="(s, i) in suggestions"
        :key="`${s.tile.id}-${s.side}`"
        class="suggestion"
        :class="{ top: i === 0 }"
        @click="place(s.tile, s.side)"
      >
        <span class="s-tile"><DominoTile :a="s.tile.hi" :b="s.tile.lo" /></span>
        <span class="s-body">
          <span class="muted"><RichText :msg="{ key: 'entry.endsAfter', params: { ends: s.ends } }" /></span>
          <span class="reasons">{{ s.reasons.map(tm).join(' · ') }}</span>
          <span v-if="s.partnerNotes.length" class="reasons">
            <template v-for="(n, j) in s.partnerNotes" :key="n.msg.key + j">
              <template v-if="j > 0"> · </template>
              <span :class="n.good ? 'good' : 'warn'"><RichText :msg="n.msg" /></span>
            </template>
          </span>
        </span>
      </button>
      <button v-if="suggestions.length === 0" class="btn btn-primary btn-wide btn-icon" @click="pass(0)">
        <ActionIcon kind="paso" />
        <RichText :msg="noTileMsg" />
      </button>
    </template>

    <!-- Someone else's turn: enter what they did. -->
    <template v-else>
      <div class="panel-title">
        <h2>{{ t('entry.turn', { seat }) }}</h2>
        <span v-if="moveInput === 'tiles'" class="muted">{{ t('entry.chanceHold') }}</span>
      </div>

      <div v-if="pending" class="choose">
        <p><RichText :msg="{ key: 'entry.whichEnd', params: { tile: pending.id } }" /></p>
        <button
          v-for="side in placements(pending, ends)"
          :key="side"
          class="btn btn-wide"
          @click="place(pending!, side)"
        >
          <RichText
            :msg="{
              key: 'entry.onEnd',
              params: { pip: side === 'left' ? ends[0] : ends[1], ends: endsAfter(pending, side) },
            }"
          />
        </button>
        <button class="btn btn-wide" @click="pending = null">{{ t('entry.cancel') }}</button>
      </div>

      <template v-else>
        <div class="input-switch">
          <button
            v-for="option in ['tiles', 'keypad'] as const"
            :key="option"
            class="btn btn-icon"
            :class="{ 'btn-primary': moveInput === option }"
            :aria-pressed="moveInput === option"
            @click="moveInput = option"
          >
            <ActionIcon :kind="option" />
            {{ option === 'tiles' ? t('entry.tiles') : t('entry.keypad') }}
          </button>
        </div>
        <TileKeypad v-if="moveInput === 'keypad'" :available="isOption" @pick="choose(parseTile($event))" />
        <div v-else class="tile-grid">
          <button
            v-for="{ tile, p } in options"
            :key="tile.id"
            class="tile-btn"
            :class="{ impossible: p === 0 }"
            @click="choose(tile)"
          >
            <DominoTile :a="tile.hi" :b="tile.lo" />
            <span class="odds">{{ pct(p) }}%</span>
          </button>
        </div>
        <p v-if="options.length === 0" class="muted">{{ t('entry.nobodyHolds') }}</p>
        <button v-if="forced.length" class="btn btn-primary btn-wide btn-icon pass" @click="passAll(forced)">
          <ActionIcon kind="paso" />
          {{ forced.length === 3 ? t('entry.paseCorrido') : t('entry.forcedPasses', { n: forced.length }) }}
        </button>
        <button v-else class="btn btn-primary btn-wide btn-icon pass" @click="pass(seat)">
          <ActionIcon kind="paso" />
          {{ t('entry.pass', { pct: pct(passP) }) }}
        </button>
      </template>
    </template>
  </section>
</template>

<style scoped>
.summary {
  margin: 0 0 6px;
  font-size: 0.9rem;
}

.suggestion {
  display: flex;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  margin-top: 6px;
  align-items: center;
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.suggestion.top {
  border: 2px solid var(--accent);
}

.s-tile {
  flex: 0 0 28px;
}

.s-body {
  min-width: 0;
}

.reasons {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.82rem;
}

.odds {
  font-size: 0.72rem;
  color: var(--muted);
}

.impossible {
  opacity: 0.4;
}

.input-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}

.pass {
  margin-top: 10px;
}

.choose p {
  margin: 0 0 8px;
}

.choose .btn + .btn {
  margin-top: 6px;
}
</style>
