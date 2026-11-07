<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseTile } from '../domain/tiles'
import { t } from '../i18n'
import type { MessageKey } from '../locales/en'
import { readTiles, type TileReading } from '../vision/detect'
import { loadCv } from '../vision/loadCv'
import ActionIcon from './ActionIcon.vue'
import DominoTile from './DominoTile.vue'

const props = defineProps<{ label: MessageKey; showTotal?: boolean; expected?: number }>()
const emit = defineEmits<{ read: [readings: TileReading[]] }>()

const LONGEST_SIDE = 1400

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const failed = ref(false)
const readings = ref<TileReading[] | null>(null)
const annotated = ref('')

const doubtful = computed(() => readings.value?.filter((r) => r.doubtful).map((r) => parseTile(r.id)) ?? [])
const total = computed(() => readings.value?.reduce((sum, r) => sum + r.pips, 0) ?? 0)

/** Shrinks the photo, since phone photos are far larger than reading a tile needs. */
async function toCanvas(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Marks each tile on the photo, in red when it needs checking, so it can be compared. */
function annotate(canvas: HTMLCanvasElement, found: TileReading[]) {
  const context = canvas.getContext('2d')!
  const size = Math.max(canvas.width, canvas.height) / 40
  context.lineWidth = size / 5
  context.font = `bold ${size}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const reading of found) {
    const color = reading.doubtful ? '#e53935' : '#1e88e5'
    context.strokeStyle = color
    context.beginPath()
    reading.corners.forEach((p, i) => (i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)))
    context.closePath()
    context.stroke()
    const x = reading.corners.reduce((sum, p) => sum + p.x, 0) / 4
    const y = reading.corners.reduce((sum, p) => sum + p.y, 0) / 4
    const width = context.measureText(reading.id).width + size / 2
    context.fillStyle = color
    context.fillRect(x - width / 2, y - size * 0.7, width, size * 1.4)
    context.fillStyle = '#ffffff'
    context.fillText(reading.id, x, y)
  }
  return canvas.toDataURL('image/jpeg', 0.8)
}

async function onPhoto(event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  element.value = ''
  if (!file) return
  busy.value = true
  failed.value = false
  // Lets the "reading" message draw before the page is busy with the photo.
  await new Promise((resolve) => setTimeout(resolve, 30))
  try {
    const cv = await loadCv()
    const canvas = await toCanvas(file)
    const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    const found = readTiles(cv, image)
    annotated.value = annotate(canvas, found)
    readings.value = found
    emit('read', found)
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}

function clear() {
  readings.value = null
  annotated.value = ''
}
</script>

<template>
  <div class="reader">
    <input ref="input" class="file" type="file" accept="image/*" capture="environment" @change="onPhoto" />
    <button class="btn btn-wide btn-icon" :disabled="busy" @click="input?.click()">
      <ActionIcon kind="camera" />
      {{ busy ? t('photo.loading') : t(props.label) }}
    </button>
    <p v-if="!readings && !busy" class="muted note">{{ t('photo.tip') }}</p>
    <p v-if="failed" class="warn note">{{ t('photo.failed') }}</p>

    <template v-if="readings">
      <p v-if="readings.length === 0" class="warn note">{{ t('photo.none') }}</p>
      <template v-else-if="showTotal">
        <p class="total">{{ t('photo.total', { n: total }) }}</p>
        <p v-if="expected !== undefined" class="muted note">{{ t('photo.expected', { n: expected }) }}</p>
        <p v-if="doubtful.length" class="warn note">{{ t('photo.unsure') }}</p>
      </template>
      <p v-else class="note">
        {{ readings.length === 1 ? t('photo.foundOne') : t('photo.found', { n: readings.length }) }}
      </p>

      <div v-if="doubtful.length" class="doubtful">
        <span class="warn">{{ t('photo.doubtful') }}:</span>
        <span v-for="(tile, i) in doubtful" :key="i" class="mini"><DominoTile :a="tile.hi" :b="tile.lo" horizontal /></span>
      </div>
      <img class="photo" :src="annotated" alt="" />
      <button class="btn btn-wide clear" @click="clear">{{ t('photo.clear') }}</button>
    </template>
  </div>
</template>

<style scoped>
.file {
  display: none;
}

.note {
  margin: 8px 0 0;
  font-size: 0.875rem;
}

.total {
  margin: 8px 0 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.doubtful {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.875rem;
}

.mini {
  width: 40px;
}

.photo {
  display: block;
  width: 100%;
  margin-top: 8px;
  border-radius: 8px;
}

.clear {
  margin-top: 8px;
}
</style>
