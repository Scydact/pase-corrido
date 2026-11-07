<script setup lang="ts">
import { computed } from 'vue'
import { canPlay, lockingPlays, numberCounts } from '../domain/game'
import type { Msg } from '../domain/messages'
import { t } from '../i18n'
import { useGame } from '../useGame'
import CountIcon from './CountIcon.vue'
import PipFace from './PipFace.vue'
import RichText from './RichText.vue'

const { state } = useGame()

const counts = computed(() => numberCounts(state.value!).slice().reverse())
const ends = computed(() => state.value!.ends)

const canPlayMsg = computed((): Msg => {
  const g = state.value!
  const others = g.unseen.filter((tile) => canPlay(tile, ends.value)).length
  const mine = g.myHand.filter((tile) => canPlay(tile, ends.value)).length
  return { key: 'counts.canPlay', params: { ends: ends.value, total: mine + others, mine, others } }
})

const locks = computed(() =>
  lockingPlays(state.value!).map(({ tile, ends: after }): { id: string; msg: Msg } => ({
    id: `${tile.id}-${after.join()}`,
    msg: {
      key: 'counts.lock',
      params: {
        tile: tile.id,
        ends: after,
        owner: t(state.value!.myHand.some((own) => own.id === tile.id) ? 'counts.ownerYours' : 'counts.ownerOther'),
      },
    },
  })),
)
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('counts.title') }}</h2>
      <span class="muted">{{ t('counts.subtitle') }}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th scope="col" :aria-label="t('counts.number')" />
          <th scope="col"><span class="head"><CountIcon kind="table" />{{ t('counts.played') }}</span></th>
          <th scope="col"><span class="head"><CountIcon kind="mine" />{{ t('counts.yours') }}</span></th>
          <th scope="col"><span class="head"><CountIcon kind="others" />{{ t('counts.others') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in counts" :key="c.number" :class="{ end: ends.includes(c.number) }">
          <th scope="row"><PipFace :n="c.number" /></th>
          <td :class="{ zero: c.played === 0 }">{{ c.played }}</td>
          <td :class="{ zero: c.mine === 0 }">{{ c.mine }}</td>
          <td class="others" :class="{ zero: c.others === 0 }">{{ c.others }}</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub">{{ t('counts.watch') }}</h3>
    <p class="note"><RichText :msg="canPlayMsg" /></p>
    <p v-if="locks.length === 0" class="note muted">{{ t('counts.noLock') }}</p>
    <p v-for="l in locks" :key="l.id" class="note warn"><RichText :msg="l.msg" /></p>
  </section>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: 5px 2px;
  text-align: center;
}

thead th {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 500;
}

.head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

tbody tr {
  border-top: 1px solid var(--line);
}

tbody th {
  color: var(--tile-border);
}

tr.end th {
  color: var(--accent);
}

.others {
  font-weight: 700;
}

.zero {
  color: var(--muted);
  font-weight: 400;
}

.sub {
  margin-top: 12px;
  font-size: 0.9rem;
}

.note {
  margin: 6px 0 0;
  font-size: 0.9rem;
  line-height: 1.6;
}
</style>
