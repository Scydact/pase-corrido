<script setup lang="ts">
import { computed } from 'vue'
import type { Msg } from '../domain/messages'
import { parseTile } from '../domain/tiles'
import { tParts } from '../i18n'
import DominoTile from './DominoTile.vue'
import PipFace from './PipFace.vue'

const props = defineProps<{ msg: Msg }>()

// These placeholders are drawn: numbers as pip faces and tiles as small dominoes.
const SLOTS = ['pip', 'a', 'b', 'nums', 'ends', 'tile', 'tiles']

const parts = computed(() => tParts(props.msg.key, SLOTS, props.msg.params))

const value = (slot: string) => props.msg.params?.[slot]
const list = (slot: string) => [value(slot)].flat()
const tileOf = (id: unknown) => parseTile(String(id))
</script>

<template>
  <span class="rich">
    <template v-for="(part, i) in parts" :key="i">
      <template v-if="'text' in part">{{ part.text }}</template>
      <span v-else-if="part.slot === 'ends'" class="faces">
        <PipFace :n="Number(list('ends')[0])" /><span class="sep">|</span><PipFace :n="Number(list('ends')[1])" />
      </span>
      <span v-else-if="part.slot === 'tile' || part.slot === 'tiles'" class="faces">
        <span v-for="id in list(part.slot)" :key="String(id)" class="mini">
          <DominoTile :a="tileOf(id).hi" :b="tileOf(id).lo" horizontal />
        </span>
      </span>
      <span v-else class="faces">
        <PipFace v-for="n in list(part.slot)" :key="String(n)" :n="Number(n)" />
      </span>
    </template>
  </span>
</template>

<style scoped>
.faces {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin: 0 1px;
  font-size: 0.75em;
  color: var(--tile-border);
  vertical-align: middle;
}

.sep {
  color: var(--muted);
}

.mini {
  display: inline-block;
  width: 3.2em;
}
</style>
