<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { isMyTeam, totalPips } from '../domain/game'
import type { ScoreLine, Team } from '../domain/score'
import { t, tm } from '../i18n'
import { useGame } from '../useGame'
import { section } from '../useNav'
import DominoTile from './DominoTile.vue'
import MoveEntry from './MoveEntry.vue'
import PhotoReader from './PhotoReader.vue'
import QuickCount from './QuickCount.vue'
import RichText from './RichText.vue'

const game = useGame()
const { state, moves, analysis, finalTranqueOdds, setup, currentLines } = game

const pct = (p: number) => Math.round(p * 100)
const g = computed(() => state.value!)
const lineTeam = (line: ScoreLine) => t(line.team === 'us' ? 'score.us' : 'score.them')

const pipsLeft = computed(() => totalPips(g.value.myHand) + totalPips(g.value.unseen))
const tieSeat = computed(() => {
  if (g.value.outcome?.kind !== 'tranque') return null
  return setup.value?.rules.tieGoesTo === 'starter' ? setup.value.starter : g.value.outcome.blocker
})

const tranqueRule = computed(() =>
  t(setup.value?.rules.tranqueMode === 'pairs' ? 'result.rulePairs' : 'result.ruleBlocker'),
)

function finishHand(winner?: Team) {
  game.finishHand(winner)
  window.scrollTo(0, 0)
}

// Keep the newest tile in view as the line grows past the screen width.
const chainEl = ref<HTMLElement | null>(null)
const newestTile = computed(() => {
  const plays = moves.value.filter((m) => m.kind === 'play')
  return plays.at(-1)?.tile ?? setup.value?.startTile
})

async function showNewest() {
  await nextTick()
  const chain = chainEl.value
  const tile = chain?.querySelector<HTMLElement>(`[data-tile="${newestTile.value}"]`)
  if (chain && tile) chain.scrollLeft = tile.offsetLeft - (chain.clientWidth - tile.offsetWidth) / 2
}

onMounted(showNewest)
watch([newestTile, section], showNewest)
</script>

<template>
  <section ref="chainEl" class="chain" :aria-label="t('game.tilesOnTable')">
    <div
      v-for="c in g.chain"
      :key="c.tile"
      :data-tile="c.tile"
      :class="c.left === c.right ? 'link double' : 'link'"
    >
      <DominoTile :a="c.left" :b="c.right" :horizontal="c.left !== c.right" />
    </div>
  </section>

  <QuickCount />

  <section v-if="g.warnings.length || analysis?.consistent === false" class="panel alert">
    <p v-for="w in g.warnings" :key="tm(w)" class="warn"><RichText :msg="w" /> {{ t('game.alertReneged') }}</p>
    <p v-if="analysis?.consistent === false" class="warn">{{ t('game.alertInconsistent') }}</p>
  </section>

  <section v-if="g.outcome" class="panel result">
    <template v-if="g.outcome.kind === 'domino'">
      <h2>
        {{ t('result.dominated', { seat: g.outcome.winner }) }}
        <span v-if="g.outcome.capicua" class="tag">{{ t('tag.capicua') }}</span>
      </h2>
      <p class="muted">{{ t(isMyTeam(g.outcome.winner) ? 'result.weWin' : 'result.theyWin') }}</p>
    </template>
    <template v-else>
      <h2>{{ t('result.tranque', { seat: g.outcome.blocker }) }}</h2>
      <p v-if="finalTranqueOdds && analysis?.consistent" class="muted">
        {{ t('result.tranqueOdds', { pct: pct(finalTranqueOdds.win), rule: tranqueRule }) }}
      </p>
    </template>
    <p v-for="(line, i) in currentLines" :key="i" class="muted">
      {{ lineTeam(line) }}: {{ t(`score.${line.kind}`) }} +{{ line.points }}
    </p>
    <div class="count-photo">
      <PhotoReader
        label="photo.takeCount"
        show-total
        :expected="g.outcome.kind === 'domino' ? pipsLeft : undefined"
      />
    </div>
    <template v-if="g.outcome.kind === 'domino'">
      <button class="btn btn-primary btn-wide" @click="finishHand()">{{ t('result.saveNext') }}</button>
    </template>
    <template v-else>
      <p class="muted">{{ t('result.whoWon', { n: pipsLeft }) }} {{ t('result.tie', { seat: tieSeat ?? 0 }) }}</p>
      <div class="winner-actions">
        <button class="btn btn-primary" @click="finishHand('us')">{{ t('result.weWon') }}</button>
        <button class="btn btn-primary" @click="finishHand('them')">{{ t('result.theyWon') }}</button>
      </div>
    </template>
  </section>

  <MoveEntry v-else />

  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('game.yourHand') }}</h2>
      <span class="muted">{{ t('game.pips', { n: totalPips(g.myHand) }) }}</span>
    </div>
    <div class="tile-grid">
      <DominoTile v-for="tile in g.myHand" :key="tile.id" :a="tile.hi" :b="tile.lo" />
    </div>
    <p v-if="g.myHand.length === 0" class="muted">{{ t('game.allPlayed') }}</p>
  </section>

  <details class="panel" :open="analysis?.consistent === false">
    <summary>{{ t('game.log') }}</summary>
    <ol class="log">
      <li v-for="(entry, i) in g.log.slice().reverse()" :key="g.log.length - i">
        <RichText :msg="entry.msg" />
        <span v-for="tag in entry.tags" :key="tag" class="tag">{{ t(`tag.${tag}`) }}</span>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.chain {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.chain::-webkit-scrollbar {
  display: none;
}

.link {
  flex: 0 0 40px;
}

.link.double {
  flex-basis: 20px;
}

/* Stays centered while it fits, and still scrolls from the start once it doesn't. */
.link:first-child {
  margin-left: auto;
}

.link:last-child {
  margin-right: auto;
}

.alert p {
  margin: 0;
  font-size: 0.9rem;
}

.alert p + p {
  margin-top: 6px;
}

.result p {
  margin: 6px 0;
}

.count-photo {
  margin: 10px 0;
}

.winner-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

summary {
  min-height: 28px;
  cursor: pointer;
  font-weight: 600;
}

.log {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.log li {
  padding: 4px 0;
}
</style>
