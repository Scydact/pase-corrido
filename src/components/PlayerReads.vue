<script setup lang="ts">
import { seatName, t, tParts } from '../i18n'
import { useGame } from '../useGame'
import DominoTile from './DominoTile.vue'
import RichText from './RichText.vue'

const { analysis, state } = useGame()

const pct = (p: number) => `${Math.round(p * 100)}%`
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('read.title') }}</h2>
    </div>
    <p v-if="!analysis?.consistent" class="muted">{{ t('read.hidden') }}</p>
    <article v-for="read in analysis?.consistent ? analysis.reads : []" :key="read.seat" class="read">
      <div class="read-head">
        <strong>{{ seatName(read.seat) }}</strong>
        <span class="muted">{{ t('read.summary', { count: read.handCount, pips: Math.round(read.expectedPips) }) }}</span>
      </div>
      <p v-if="read.missing.length" class="line">
        <span class="warn"><RichText :msg="{ key: 'read.no', params: { nums: read.missing } }" /></span>
      </p>
      <p v-if="read.certain.length" class="line">
        <span class="good"><RichText :msg="{ key: 'read.has', params: { tiles: read.certain.map((tile) => tile.id) } }" /></span>
      </p>
      <details v-if="read.possible.length">
        <summary class="line">
          <template v-for="(part, i) in tParts('read.possibly', ['list'])" :key="i">
            <template v-if="'text' in part">{{ part.text }}</template>
            <span v-else class="top-odds">
              <span v-for="o in read.possible.slice(0, 3)" :key="o.tile.id" class="top-odd">
                <span class="mini"><DominoTile :a="o.tile.hi" :b="o.tile.lo" horizontal /></span>
                <span class="muted">{{ pct(o.p) }}</span>
              </span>
            </span>
          </template>
        </summary>
        <div class="tile-grid odds-grid">
          <div v-for="o in read.possible" :key="o.tile.id" class="odds-cell">
            <DominoTile :a="o.tile.hi" :b="o.tile.lo" />
            <span class="muted">{{ pct(o.p) }}</span>
          </div>
        </div>
      </details>
    </article>
    <p v-if="analysis?.consistent" class="muted foot">{{ t('read.note', { n: state?.unseen.length ?? 0 }) }}</p>
  </section>
</template>

<style scoped>
.read {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.read:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.read-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.line {
  margin: 4px 0 0;
  font-size: 0.9rem;
}

summary {
  cursor: pointer;
}

.top-odds {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 2px;
  vertical-align: middle;
}

.top-odd {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.mini {
  display: inline-block;
  width: 34px;
}

.odds-grid {
  margin-top: 8px;
}

.odds-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.72rem;
}

.foot {
  margin: 8px 0 0;
}
</style>
