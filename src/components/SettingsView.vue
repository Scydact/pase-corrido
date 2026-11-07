<script setup lang="ts">
import { canVibrate, vibrationOn } from '../haptics'
import { lang, LANG_NAMES, LANGS, t } from '../i18n'
import { useGame } from '../useGame'
import ThemeSettings from './ThemeSettings.vue'

const { settings, rules } = useGame()
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('settings.language') }}</h2>
    </div>
    <div class="choices">
      <button
        v-for="option in LANGS"
        :key="option"
        class="btn"
        :class="{ 'btn-primary': lang === option }"
        :aria-pressed="lang === option"
        :lang="option"
        @click="lang = option"
      >
        {{ LANG_NAMES[option] }}
      </button>
    </div>
    <label v-if="canVibrate" class="row vibration">
      {{ t('settings.vibration') }}
      <input v-model="vibrationOn" type="checkbox" />
    </label>
  </section>

  <ThemeSettings />

  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('settings.bonus') }}</h2>
    </div>
    <label class="row">
      {{ t('score.capicua') }}
      <select v-model.number="settings.capicua">
        <option :value="25">25</option>
        <option :value="30">30</option>
      </select>
    </label>
    <label class="row">
      {{ t('score.salida') }}
      <select v-model.number="settings.salida">
        <option :value="10">10</option>
        <option :value="25">25</option>
      </select>
    </label>
    <p class="muted note">{{ t('settings.bonusNote') }}</p>
  </section>

  <section class="panel">
    <div class="panel-title">
      <h2>{{ t('setup.rules') }}</h2>
    </div>
    <fieldset>
      <legend>{{ t('setup.whoCompares') }}</legend>
      <label>
        <input v-model="rules.tranqueMode" type="radio" value="blockerVsNext" />
        {{ t('setup.blockerVsNext') }}
      </label>
      <label><input v-model="rules.tranqueMode" type="radio" value="pairs" /> {{ t('setup.pairs') }}</label>
    </fieldset>
    <fieldset>
      <legend>{{ t('setup.tieGoesTo') }}</legend>
      <label><input v-model="rules.tieGoesTo" type="radio" value="blocker" /> {{ t('setup.tieBlocker') }}</label>
      <label><input v-model="rules.tieGoesTo" type="radio" value="starter" /> {{ t('setup.tieStarter') }}</label>
    </fieldset>
    <p class="muted note">{{ t('settings.rulesNote') }}</p>
  </section>
</template>

<style scoped>
.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 44px;
}

select {
  min-height: 36px;
  min-width: 72px;
  padding: 4px 8px;
  font: inherit;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.vibration {
  margin-top: 8px;
}

input[type='checkbox'] {
  width: 22px;
  height: 22px;
  accent-color: var(--accent);
}

.note {
  margin: 8px 0 0;
}

fieldset {
  border: 0;
  padding: 0;
  margin: 8px 0 0;
}

legend {
  padding: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

fieldset label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
}
</style>
