<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WeddingFrame } from '../data/frames'
import type { CapturedPhoto } from '../utils/photoCapture'
import { getPhotoTargets, prepareUploadedPhoto } from '../utils/photoUpload'
import { isCoupleAlbumReady } from '../utils/coupleAlbum'
import CapturedPhotosReview from './CapturedPhotosReview.vue'

const props = defineProps<{ frame: WeddingFrame }>()
defineEmits<{ back: [] }>()
const photos = ref<(CapturedPhoto | null)[]>(Array.from({ length: props.frame.photoCount }, () => null))
const fileInput = ref<HTMLInputElement | null>(null)
const content = ref<HTMLDivElement | null>(null)
const isProcessing = ref(false)
const processingSlot = ref<number | null>(null)
const errorMessage = ref('')
const isReview = ref(false)
const albumReady = ref(false)
const filledCount = computed(() => photos.value.filter(Boolean).length)
const completedPhotos = computed(() => photos.value.filter((photo): photo is CapturedPhoto => photo !== null))
const canCreate = computed(() => filledCount.value === props.frame.photoCount && !isProcessing.value)
const albumAbort = new AbortController()
let selectionAbort: AbortController | null = null
let replaceIndex: number | null = null
let disposed = false

function choosePhotos(index: number | null = null): void {
  if (isProcessing.value || !fileInput.value) return
  replaceIndex = index
  fileInput.value.multiple = index === null
  fileInput.value.value = ''
  fileInput.value.click()
}

async function selectFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length || isProcessing.value) return
  errorMessage.value = ''
  const controller = new AbortController()
  selectionAbort = controller
  isProcessing.value = true
  try {
    const targets = getPhotoTargets(props.frame.photoCount, photos.value.map(Boolean), replaceIndex, files.length)
    // Prepare sequentially to avoid decoding multiple large phone images at once.
    // Apply the batch only after every selected file succeeds.
    const updated = [...photos.value]
    for (const [fileIndex, target] of targets.entries()) {
      const slot = props.frame.layout.slots[target]
      const file = files[fileIndex]
      if (!slot || !file) throw new Error('A photo slot is missing. Please choose your photos again.')
      processingSlot.value = target + 1
      updated[target] = await prepareUploadedPhoto(file, slot.width / slot.height, controller.signal)
      if (controller.signal.aborted || disposed) return
    }
    photos.value = updated
  } catch (error) {
    if (!controller.signal.aborted && !disposed) {
      errorMessage.value = error instanceof Error ? error.message : 'Your photos could not be opened. Please try again.'
    }
  } finally {
    if (selectionAbort === controller && !disposed) {
      isProcessing.value = false
      processingSlot.value = null
      selectionAbort = null
      input.value = ''
    }
  }
}

function movePhoto(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (isProcessing.value || target < 0 || target >= photos.value.length) return
  const updated = [...photos.value]
  const photo = updated[index] ?? null
  updated[index] = updated[target] ?? null
  updated[target] = photo
  photos.value = updated
}

async function createStrip(): Promise<void> {
  if (!canCreate.value) return
  isReview.value = true
  await nextTick()
  content.value?.querySelector<HTMLElement>('h1')?.focus()
  window.scrollTo(0, 0)
}

async function startAgain(): Promise<void> {
  photos.value = Array.from({ length: props.frame.photoCount }, () => null)
  errorMessage.value = ''
  isReview.value = false
  await nextTick()
  content.value?.querySelector<HTMLElement>('h1')?.focus()
  window.scrollTo(0, 0)
}

onMounted(() => {
  void isCoupleAlbumReady(albumAbort.signal)
    .then((ready) => { if (!disposed) albumReady.value = ready })
    .catch(() => {})
})
onBeforeUnmount(() => {
  disposed = true
  selectionAbort?.abort()
  albumAbort.abort()
})
</script>

<template>
  <main class="upload" :aria-labelledby="isReview ? 'review-title' : 'upload-title'">
    <div ref="content" class="content">
      <CapturedPhotosReview v-if="isReview" :frame="frame" :photos="completedPhotos" source="upload" @restart="startAgain" @back="$emit('back')" />
      <template v-else>
        <button class="back" type="button" @click="$emit('back')">← Back to strips</button>
        <h1 id="upload-title" tabindex="-1">Your Favourite Moments</h1>
        <p class="selected">{{ frame.name }} · {{ frame.photoCount }}-photo strip</p>
        <p class="intro">Choose {{ frame.photoCount === 1 ? 'one photo' : `${frame.photoCount} photos` }} from your gallery. Arrange them just how you like.</p>
        <input ref="fileInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple aria-label="Choose photos from your device" @change="selectFiles" />
        <button v-if="filledCount < frame.photoCount" class="primary" type="button" :disabled="isProcessing" @click="choosePhotos()">{{ filledCount ? 'Add photos' : 'Choose photos' }}</button>
        <p class="hint">Up to 15 MB per photo. Photos are cropped to fit your strip.</p>
        <ol class="photo-grid" :class="{ single: frame.photoCount === 1 }" :aria-busy="isProcessing">
          <li v-for="(photo, index) in photos" :key="index" class="photo-slot">
            <p class="slot-label">Photo {{ index + 1 }}</p>
            <div class="slot-image" :style="{ aspectRatio: `${frame.layout.slots[index]?.width} / ${frame.layout.slots[index]?.height}` }">
              <img v-if="photo" :src="photo.url" :width="photo.width" :height="photo.height" :alt="`Photo ${index + 1} preview`" />
              <button v-else class="empty-slot" type="button" :disabled="isProcessing" :aria-label="`Choose photo ${index + 1}`" @click="choosePhotos(index)"><span aria-hidden="true">＋</span> Choose photo</button>
            </div>
            <div v-if="photo" class="slot-actions">
              <button type="button" :disabled="isProcessing" :aria-label="`Change photo ${index + 1}`" @click="choosePhotos(index)">Change</button>
              <button v-if="index > 0" type="button" :disabled="isProcessing" :aria-label="`Move photo ${index + 1} up`" @click="movePhoto(index, -1)">↑</button>
              <button v-if="index < frame.photoCount - 1" type="button" :disabled="isProcessing" :aria-label="`Move photo ${index + 1} down`" @click="movePhoto(index, 1)">↓</button>
            </div>
          </li>
        </ol>
        <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
        <p class="status" role="status">{{ isProcessing ? `Preparing photo ${processingSlot ?? ''}…` : `${filledCount} of ${frame.photoCount} photos ready` }}</p>
        <button class="primary create" type="button" :disabled="!canCreate" @click="createStrip">Create my strip</button>
        <p v-if="albumReady" class="hint">Your finished strip will be saved privately for Adlina &amp; Fareez ♡</p>
      </template>
      <footer>Designed &amp; developed by the bride, Syira ♡</footer>
    </div>
  </main>
</template>

<style scoped>
@font-face { font-family: 'Great Vibes'; src: url('../assets/fonts/GreatVibes-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
.upload { min-height: 100svh; padding: 1.25rem 1rem; background: url('../assets/Background.jpeg') center / cover no-repeat; color: #fff; text-align: center; font-family: Georgia, 'Times New Roman', serif; text-shadow: 0 2px 5px rgb(0 0 0 / 75%); }
.content { width: min(100%, 38rem); margin-inline: auto; }
h1 { margin: 1rem 0 .5rem; font: 400 clamp(2.3rem, 9vw, 3.2rem)/1.3 'Great Vibes', cursive; }
.selected, .intro { font-size: .85rem; line-height: 1.8; }
button { min-height: 2.75rem; padding: .65rem .9rem; border: 1px solid #fff; border-radius: .4rem; color: #fff; background: transparent; font: inherit; font-size: .8rem; cursor: pointer; }
button:hover { background: #562536; }
button:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
button:disabled { opacity: .5; cursor: default; }
.back { display: block; padding-left: .25rem; border: 0; text-shadow: inherit; }
.back:hover { background: transparent; text-decoration: underline; text-underline-offset: .25rem; }
.primary { background: #713548; }
.file-input { display: none; }
.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; padding: 0; margin: 1.25rem 0; list-style: none; }
.photo-grid.single { grid-template-columns: minmax(0, 1fr); width: min(100%, 23rem); margin-inline: auto; }
.photo-slot { min-width: 0; }
.slot-label { font-size: .8rem; }
.slot-image { overflow: hidden; border: 1px dashed rgb(255 255 255 / 70%); border-radius: .5rem; background: rgb(0 0 0 / 35%); }
.slot-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
.empty-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .3rem; width: 100%; height: 100%; border: 0; padding: .4rem; font-size: .75rem; }
.empty-slot span { font-size: 1.5rem; }
.slot-actions { display: flex; align-items: center; justify-content: center; gap: .25rem; flex-wrap: wrap; padding-top: .4rem; }
.slot-actions button { padding: .3rem .5rem; font-size: .75rem; }
.status { min-height: 1.5rem; font-size: .8rem; line-height: 1.7; }
.hint { font-size: .7rem; line-height: 1.8; }
.error { padding: .8rem; border-radius: .4rem; background: #562536; font-size: .85rem; line-height: 1.8; }
.create { margin-bottom: .5rem; }
footer { margin-top: 2rem; font-size: .6rem; text-transform: uppercase; letter-spacing: .08em; line-height: 1.8; }
@media (min-width: 40rem) { .photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
