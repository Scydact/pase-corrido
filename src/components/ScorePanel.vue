<script setup lang="ts">
import { totals, type ScoreLine, type Team } from '../domain/score'
import { t } from '../i18n'
import { useGame } from '../useGame'

const { score, hands, currentLines, removeLastHand, resetScore } = useGame()

const teamName = (team: Team) => t(team === 'us' ? 'score.us' : 'score.them')
const lineLabel = (line: ScoreLine) => t(`score.${line.kind}`)

function summary(lines: ScoreLine[]) {
  const sums = totals(lines)
  return t('score.handSummary', { us: teamName('us'), usPoints: sums.us, them: teamName('them'), themPoints: sums.them })
}

function reset() {
  if (window.confirm(t('score.confirmReset'))) resetScore()
}
</script>

<template>
  <section class="panel">
    <div class="scores">
      <div class="side">
        <span class="muted">{{ teamName('us') }}</span>
        <strong>{{ score.us }}</strong>
      </div>
      <div class="side">
        <span class="muted">{{ teamName('them') }}</span>
        <strong>{{ score.them }}</strong>
      </div>
    </div>

    <p v-for="(line, i) in currentLines" :key="i" class="muted current">
      {{ t('score.thisHand', { team: teamName(line.team), points: line.points, label: lineLabel(line).toLowerCase() }) }}
    </p>
  </section>

  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('score.history') }}</h2>
    </div>
    <ol v-if="hands.length" class="history">
      <li v-for="(lines, i) in hands" :key="i">
        <strong>{{ t('score.hand', { n: i + 1 }) }}</strong> {{ summary(lines) }}
        <span v-for="(line, j) in lines" :key="j" class="muted line">
          {{ teamName(line.team) }}: {{ lineLabel(line) }} +{{ line.points }}
        </span>
        <span v-if="lines.length === 0" class="muted line">{{ t('score.noPoints') }}</span>
      </li>
    </ol>
    <p v-else class="muted empty">{{ t('score.noHands') }}</p>

    <div class="actions">
      <button class="btn" :disabled="hands.length === 0" @click="removeLastHand">{{ t('score.removeLast') }}</button>
      <button class="btn" :disabled="hands.length === 0" @click="reset">{{ t('score.reset') }}</button>
    </div>
  </section>
</template>

<style scoped>
.scores {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  text-align: center;
}

.side {
  display: flex;
  flex-direction: column;
}

.side strong {
  font-size: 2.25rem;
  font-variant-numeric: tabular-nums;
}

.current {
  margin: 6px 0 0;
  text-align: center;
}

.history {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.history li {
  padding: 6px 0;
  border-top: 1px solid var(--line);
}

.history li:first-child {
  border-top: 0;
  padding-top: 0;
}

.line {
  display: block;
}

.empty {
  margin: 0 0 8px;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.actions .btn {
  padding: 8px 6px;
}
</style>
