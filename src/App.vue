<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import GameHeader from './components/GameHeader.vue'
import GameView from './components/GameView.vue'
import NavBar from './components/NavBar.vue'
import NumberCounts from './components/NumberCounts.vue'
import PlayerReads from './components/PlayerReads.vue'
import ScorePanel from './components/ScorePanel.vue'
import SettingsView from './components/SettingsView.vue'
import SetupView from './components/SetupView.vue'
import { lang, t } from './i18n'
import { useGame } from './useGame'
import { goTo, section } from './useNav'

const { setup } = useGame()

watchEffect(() => {
  document.documentElement.lang = lang.value
  document.title = t('app.title')
})

const needsHand = computed(() => section.value === 'players' || section.value === 'count')
const showGameHeader = computed(() => setup.value && (section.value === 'table' || needsHand.value))
</script>

<template>
  <GameHeader v-if="showGameHeader" :actions="section === 'table'" />
  <header v-else-if="section !== 'table'" class="page-head">
    <h1>{{ t(`nav.${section}`) }}</h1>
  </header>

  <!-- Sections stay mounted so a half-entered tile or setup survives switching away. -->
  <main>
    <div v-show="section === 'table'">
      <GameView v-if="setup" />
      <SetupView v-else />
    </div>
    <div v-show="section === 'players'"><PlayerReads v-if="setup" /></div>
    <div v-show="section === 'count'"><NumberCounts v-if="setup" /></div>
    <section v-if="needsHand && !setup" class="panel no-hand">
      <p>{{ t('empty.noHand') }}</p>
      <button class="btn btn-primary btn-wide" @click="goTo('table')">{{ t('empty.goToTable') }}</button>
    </section>
    <div v-show="section === 'score'"><ScorePanel /></div>
    <div v-show="section === 'settings'"><SettingsView /></div>
  </main>

  <NavBar />
</template>

<style scoped>
.page-head {
  padding: calc(14px + env(safe-area-inset-top)) 0 2px;
}

.no-hand p {
  margin: 0 0 10px;
}
</style>
