<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WeddingFrame } from '../data/frames'
import type { CapturedPhoto } from '../utils/photoCapture'
import { composeStrip, getStripFilename } from '../utils/stripComposer'
import { isCoupleAlbumReady, sendStripToCouple } from '../utils/coupleAlbum'

const props = defineProps<{ frame: WeddingFrame; photos: CapturedPhoto[] }>()
const emit = defineEmits<{ 'album-saving': [busy: boolean] }>()
const albumReady = ref(false)
const isAlbumSaving = ref(false)
const isAlbumSaved = ref(false)
const albumError = ref('')
const albumAbort = new AbortController()
let uploadId = ''
let autoSaveAttempted = false
let activeSaveController: AbortController | null = null
let disposed = false
const previewUrl = ref('')
const isRendering = ref(false)
const errorMessage = ref('')
const canShare = ref(false)
const isSharing = ref(false)
let stripBlob: Blob | null = null
let renderId = 0

function releasePreview(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  stripBlob = null
  canShare.value = false
}

async function renderStrip(): Promise<void> {
  const currentRender = ++renderId
  activeSaveController?.abort()
  activeSaveController = null
  isAlbumSaving.value = false
  emit('album-saving', false)
  autoSaveAttempted = false
  releasePreview()
  isAlbumSaved.value = false
  albumError.value = ''
  uploadId = ''
  isRendering.value = true
  errorMessage.value = ''
  try {
    const blob = await composeStrip(props.frame, props.photos)
    if (currentRender !== renderId) return
    stripBlob = blob
    previewUrl.value = URL.createObjectURL(blob)
    const file = new File([blob], getStripFilename(props.frame), { type: 'image/png' })
    try {
      canShare.value = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
    } catch {
      canShare.value = false
    }
    maybeAutoSave()
  } catch (error) {
    if (currentRender !== renderId) return
    errorMessage.value = error instanceof Error ? error.message : 'Your strip could not be created. Please try again.'
  } finally {
    if (currentRender === renderId) isRendering.value = false
  }
}

async function shareStrip(): Promise<void> {
  if (!stripBlob || isSharing.value) return
  isSharing.value = true
  errorMessage.value = ''
  try {
    await navigator.share({
      files: [new File([stripBlob], getStripFilename(props.frame), { type: 'image/png' })],
      title: 'Adlina & Fareez — Our Wedding Photostrip',
    })
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      errorMessage.value = 'Sharing is unavailable right now. Use Download PNG instead.'
    }
  } finally {
    isSharing.value = false
  }
}

function maybeAutoSave(): void {
  if (disposed || !albumReady.value || !stripBlob || autoSaveAttempted) return
  autoSaveAttempted = true
  void saveToCouple()
}

async function saveToCouple(): Promise<void> {
  if (disposed || !albumReady.value || !stripBlob || isAlbumSaving.value || isAlbumSaved.value) return
  const blob = stripBlob
  const frame = props.frame
  const currentRender = renderId
  const controller = new AbortController()
  activeSaveController = controller
  isAlbumSaving.value = true
  albumError.value = ''
  emit('album-saving', true)
  try {
    uploadId ||= crypto.randomUUID()
    await sendStripToCouple(blob, frame, uploadId, controller.signal)
    if (!disposed && currentRender === renderId) isAlbumSaved.value = true
  } catch (error) {
    if (!disposed && currentRender === renderId) albumError.value = error instanceof Error ? error.message : 'Your strip could not be saved. Please try again.'
  } finally {
    if (!disposed && activeSaveController === controller) {
      activeSaveController = null
      isAlbumSaving.value = false
      emit('album-saving', false)
    }
  }
}

onMounted(async () => {
  try {
    const ready = await isCoupleAlbumReady(albumAbort.signal)
    if (!disposed) {
      albumReady.value = ready
      maybeAutoSave()
    }
  } catch { /* Download remains available when album saving is not connected. */ }
})

watch(() => [props.frame.id, ...props.photos.map((photo) => photo.url)], renderStrip, { immediate: true })
onBeforeUnmount(() => {
  disposed = true
  albumAbort.abort()
  activeSaveController?.abort()
  renderId += 1
  releasePreview()
})
</script>

<template>
  <section class="finished" aria-labelledby="finished-title" :aria-busy="isRendering">
    <h2 id="finished-title">Your Wedding Keepsake</h2>
    <p v-if="isRendering" class="message" role="status">Putting your lovely moments together…</p>
    <template v-if="previewUrl">
      <img class="strip" :src="previewUrl" :width="frame.layout.width" :height="frame.layout.height"
        :alt="`Your finished ${frame.name} wedding strip with ${frame.photoCount} photos`" />
      <div class="save-actions">
        <a class="save-button" :href="previewUrl" :download="getStripFilename(frame)">Download PNG</a>
        <button v-if="canShare" class="save-button secondary" type="button" :disabled="isSharing" @click="shareStrip">{{
          isSharing ? 'Opening…' : 'Share / Save' }}</button>
      </div>
      <div v-if="albumReady" class="album-save">
        <p class="hint">Your finished strip will be saved privately for Adlina &amp; Fareez ♡</p>
        <p v-if="isAlbumSaving" class="hint saving-status" role="status">Saving your keepsake… <span class="saving-spinner" aria-hidden="true"></span></p>
        <p v-else-if="isAlbumSaved" class="hint" role="status">Saved for Adlina &amp; Fareez ♡</p>
        <template v-if="albumError">
          <p class="error" role="alert">{{ albumError }}</p>
          <button class="save-button secondary" type="button" :disabled="isAlbumSaving" @click="saveToCouple">Retry
            saving</button>
        </template>
      </div>
      <p v-if="canShare" class="hint">On iPhone, you can also use Share / Save → Save Image.</p>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <button v-if="!previewUrl && !isRendering" class="save-button" type="button" @click="renderStrip">Try again</button>
  </section>
</template>

<style scoped>
.saving-status { display: flex; align-items: center; justify-content: center; gap: .45rem; }
.saving-spinner { display: inline-block; flex: 0 0 auto; width: .8rem; height: .8rem; border: 1.5px solid rgb(255 255 255 / 30%); border-top-color: currentColor; border-radius: 50%; animation: saving-spin .8s linear infinite; }
@keyframes saving-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .saving-spinner { animation: none; } }

.finished {
  margin: 1.5rem 0;
}

h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 400;
}

.strip {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 65svh;
  margin-inline: auto;
  border-radius: .25rem;
  box-shadow: 0 8px 30px rgb(0 0 0 / 25%);
}

.album-save {
  margin-top: 1rem;
}

.save-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: .75rem;
  margin-top: 1.25rem;
}

.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: .7rem 1rem;
  background: #713548;
  color: #fff;
  border: 1px solid #fff;
  border-radius: .4rem;
  font: inherit;
  font-size: .8rem;
  text-decoration: none;
  cursor: pointer;
}

.save-button:hover {
  background: #562536;
}

.save-button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

.secondary {
  background: rgb(0 0 0 / 25%);
}

.save-button:disabled {
  opacity: .65;
  cursor: wait;
}

.message {
  padding: 3rem 1rem;
  font-size: .85rem;
  line-height: 1.8;
}

.hint {
  font-size: .65rem;
  line-height: 1.8;
}

.error {
  background: #562536;
  padding: .75rem;
  border-radius: .4rem;
  font-size: .8rem;
  line-height: 1.8;
}
</style>
