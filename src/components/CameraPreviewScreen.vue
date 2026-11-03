<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WeddingFrame } from '../data/frames'
import CapturedPhotosReview from './CapturedPhotosReview.vue'
import { isCoupleAlbumReady } from '../utils/coupleAlbum'
import { captureVideoFrame, runCountdown, waitForCaptureFeedback, type CapturedPhoto } from '../utils/photoCapture'

const props = defineProps<{ frame: WeddingFrame }>()
defineEmits<{ back: [] }>()

const video = ref<HTMLVideoElement | null>(null)
const isStarting = ref(false)
const isActive = ref(false)
const albumReady = ref(false)
const albumAvailabilityAbort = new AbortController()
const errorMessage = ref('')
const photos = ref<CapturedPhoto[]>([])
const isReview = ref(false)
const isCapturing = ref(false)
const countdown = ref<number | null>(null)
const capturedPose = ref<CapturedPhoto | null>(null)
const shotNumber = ref<number | null>(null)
const retakeIndex = ref<number | null>(null)
const reviewContainer = ref<HTMLDivElement | null>(null)
const captureLabel = computed(() => retakeIndex.value !== null
  ? `Retake photo ${retakeIndex.value + 1}`
  : photos.value.length === props.frame.photoCount ? 'Review photos'
    : photos.value.length > 0 ? 'Continue photos' : 'Capture photos')
const statusMessage = computed(() => {
  if (capturedPose.value) return `Photo ${shotNumber.value} taken! ${photos.value.length === props.frame.photoCount ? 'Your strip is next…' : 'Get ready for your next pose.'}`
  if (isCapturing.value) return `Photo ${shotNumber.value} of ${props.frame.photoCount} — get ready!`
  if (isActive.value) return 'Camera is on. Strike your favourite pose!'
  return 'Camera is off.'
})
let captureAbort: AbortController | null = null
const previewMessage = computed(() =>
  isStarting.value ? 'Waiting for camera access…' : 'Your camera preview will appear here.',
)
let stream: MediaStream | null = null
let requestId = 0
let disposed = false

function cancelCapture(): void {
  captureAbort?.abort()
  captureAbort = null
  isCapturing.value = false
  countdown.value = null
  capturedPose.value = null
  shotNumber.value = null
}

function stopCamera(): void {
  cancelCapture()
  requestId += 1
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (video.value) video.value.srcObject = null
  isActive.value = false
  isStarting.value = false
}

async function startCamera(): Promise<void> {
  if (isStarting.value || isActive.value) return
  errorMessage.value = ''
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'Camera preview needs HTTPS or localhost. Open this page in a supported browser over a secure connection.'
    return
  }
  const currentRequest = ++requestId
  isStarting.value = true
  try {
    const openedStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } },
    })
    // A permission prompt may finish after leaving this screen or hiding the tab.
    if (disposed || currentRequest !== requestId || document.hidden) {
      openedStream.getTracks().forEach((track) => track.stop())
      return
    }
    stream = openedStream
    if (!video.value) throw new Error('Preview unavailable')
    video.value.srcObject = openedStream
    await video.value.play()
    if (currentRequest !== requestId || disposed) return
    isActive.value = true
    openedStream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (stream !== openedStream) return
        stopCamera()
        errorMessage.value = 'The camera stopped. You can open it again when you are ready.'
      }, { once: true })
    })
  } catch (error) {
    if (disposed || currentRequest !== requestId) return
    stopCamera()
    const name = error instanceof DOMException ? error.name : ''
    errorMessage.value = name === 'NotAllowedError'
      ? 'Camera access was not allowed. Enable camera permission for this site in your browser settings, then try again.'
      : name === 'NotFoundError'
        ? 'No camera was found on this device.'
        : name === 'NotReadableError'
          ? 'The camera is busy or unavailable. Close other apps using it and try again.'
          : 'The camera could not open. Please try again in your browser.'
  } finally {
    if (currentRequest === requestId) isStarting.value = false
  }
}

async function showReview(): Promise<void> {
  stopCamera()
  retakeIndex.value = null
  isReview.value = true
  await nextTick()
  reviewContainer.value?.querySelector<HTMLElement>('h1')?.focus()
}

async function capturePhotos(): Promise<void> {
  if (!isActive.value || isCapturing.value || !video.value) return
  if (video.value.readyState < 2 || !video.value.videoWidth) {
    errorMessage.value = 'The camera is still warming up. Please try again in a moment.'
    return
  }
  errorMessage.value = ''
  const controller = new AbortController()
  captureAbort = controller
  isCapturing.value = true
  const indices = retakeIndex.value !== null
    ? [retakeIndex.value]
    : Array.from({ length: props.frame.photoCount - photos.value.length }, (_, index) => photos.value.length + index)
  try {
    for (const index of indices) {
      shotNumber.value = index + 1
      await runCountdown((seconds) => { countdown.value = seconds }, controller.signal)
      if (controller.signal.aborted || disposed || !isActive.value || !video.value) return
      const photo = captureVideoFrame(video.value)
      photos.value = photos.value.map((existing, existingIndex) => existingIndex === index ? photo : existing)
      if (index === photos.value.length) photos.value = [...photos.value, photo]
      countdown.value = null
      capturedPose.value = photo
      await waitForCaptureFeedback(controller.signal)
      if (controller.signal.aborted || disposed || !isActive.value) return
      capturedPose.value = null
    }
    await showReview()
  } catch (error) {
    if (controller.signal.aborted || disposed) return
    stopCamera()
    errorMessage.value = error instanceof Error ? error.message : 'Your photo could not be captured. Please try again.'
  } finally {
    if (captureAbort === controller) cancelCapture()
  }
}

async function retakePhoto(index: number): Promise<void> {
  if (!photos.value[index]) return
  retakeIndex.value = index
  isReview.value = false
  await nextTick()
  await startCamera()
}

async function retakeAll(): Promise<void> {
  stopCamera()
  photos.value = []
  retakeIndex.value = null
  isReview.value = false
  errorMessage.value = ''
  await nextTick()
  await startCamera()
}

function handleVisibility(): void {
  if (document.hidden) stopCamera()
}

onMounted(() => {
  void isCoupleAlbumReady(albumAvailabilityAbort.signal)
    .then((ready) => { if (!disposed) albumReady.value = ready })
    .catch(() => { /* Camera remains available if the album is unavailable. */ })
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pagehide', stopCamera)
})
onBeforeUnmount(() => {
  disposed = true
  albumAvailabilityAbort.abort()
  stopCamera()
  document.removeEventListener('visibilitychange', handleVisibility)
  window.removeEventListener('pagehide', stopCamera)
})
</script>

<template>
  <main class="camera" :aria-labelledby="isReview ? 'review-title' : 'camera-title'">
    <div class="content">
      <div v-if="isReview" ref="reviewContainer">
        <CapturedPhotosReview :frame="frame" :photos="photos" @retake="retakePhoto" @restart="retakeAll"
          @back="$emit('back')" />
      </div>
      <template v-else>
        <button class="back" type="button" @click="$emit('back')">← Back to strips</button>
        <h1 id="camera-title" tabindex="-1">Ready, Set, Pose!</h1>
        <p class="selected">{{ frame.name }} · {{ frame.photoCount }}-photo strip</p>
        <p class="progress">{{ photos.length }} of {{ frame.photoCount }} photos taken<span v-if="retakeIndex !== null">
            · Retaking photo {{ retakeIndex + 1 }}</span></p>
        <div class="viewfinder" :aria-busy="isStarting || isCapturing">
          <video ref="video" autoplay muted playsinline aria-label="Live front camera preview"
            :class="{ visible: isActive }"></video>
          <template v-if="capturedPose">
            <img class="captured-pose" :src="capturedPose.url" alt="Your just-captured pose" />
            <div class="shutter-flash" aria-hidden="true"></div>
            <p class="capture-confirmation"><span aria-hidden="true">✓</span> Photo {{ shotNumber }} taken</p>
          </template>
          <p v-if="!isActive" class="preview-message">{{ previewMessage }}</p>
          <div v-if="countdown !== null" class="countdown" role="status" aria-live="polite" aria-atomic="true">
            <span class="shot-label">Photo {{ shotNumber }} of {{ frame.photoCount }}</span>
            <span class="countdown-number">{{ countdown }}</span>
          </div>
        </div>
        <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
        <div class="controls">
          <button v-if="!isActive" class="primary" type="button" :disabled="isStarting" @click="startCamera">{{
            isStarting ? 'Opening camera…' : 'Open Camera' }}</button>
          <template v-else>
            <button v-if="!isCapturing" class="primary" type="button" @click="capturePhotos">{{ captureLabel }}</button>
            <button v-else class="primary" type="button" @click="cancelCapture">Pause session</button>
            <button class="back" type="button" @click="stopCamera">Stop Camera</button>
          </template>
          <button v-if="isStarting" class="back" type="button" @click="stopCamera">Cancel</button>
          <button v-if="photos.length === frame.photoCount && !isCapturing" class="back" type="button"
            @click="showReview">Back to
            review</button>
        </div>
        <p class="status" role="status">{{ statusMessage }}</p>
        <p class="note">Each photo has a 3-second countdown.</p>
        <p v-if="albumReady" class="note">Your finished strip will be saved privately for Adlina &amp; Fareez ♡</p>
      </template>
      <footer>Designed &amp; developed by the bride, Syira ♡</footer>
    </div>
  </main>
</template>

<style scoped>
@font-face {
  font-family: 'Great Vibes';
  src: url('../assets/fonts/GreatVibes-Regular.ttf') format('truetype');
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

.camera {
  min-height: 100svh;
  padding: 1.25rem 1rem;
  background: url('../assets/Background.jpeg') center / cover no-repeat;
  color: #fff;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
  text-shadow: 0 2px 5px rgb(0 0 0 / 75%);
}

.content {
  width: min(100%, 32rem);
  margin-inline: auto;
}

button {
  min-height: 2.75rem;
  padding: .7rem 1rem;
  font: inherit;
  color: #fff;
  cursor: pointer;
  border-radius: .4rem;
}

.back {
  display: block;
  border: 0;
  background: transparent;
  text-shadow: inherit;
  font-size: .8rem;
}

.back:hover {
  text-decoration: underline;
  text-underline-offset: .25rem;
}

button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

h1 {
  font: 400 clamp(2.3rem, 9vw, 3.2rem)/1.3 'Great Vibes', cursive;
  margin: 1rem 0 .5rem;
}

.selected {
  font-size: .8rem;
  line-height: 1.7;
}

.viewfinder {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  margin-block: 1.25rem;
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 1rem;
  overflow: hidden;
  background: #211e20;
}

video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  opacity: 0;
}

video.visible {
  opacity: 1;
}

.preview-message {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  padding: 1rem;
  font-size: .9rem;
  line-height: 1.7;
  margin: 0;
}

.captured-pose { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.shutter-flash { position: absolute; inset: 0; pointer-events: none; background: #fff; opacity: 0; animation: shutter-flash 240ms ease-out; }
.capture-confirmation { position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100% - 2rem); margin: 0; padding: .65rem 1rem; border-radius: 2rem; background: rgb(33 30 32 / 85%); color: #fff; font-size: .9rem; line-height: 1.5; }
@keyframes shutter-flash { from { opacity: .75; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .shutter-flash { display: none; animation: none; } }

.progress {
  font-size: .75rem;
  line-height: 1.7;
}

.countdown {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .25rem;
  pointer-events: none;
  background: rgb(0 0 0 / 15%);
}

.shot-label {
  font-size: .9rem;
}

.countdown-number {
  font: 400 clamp(5rem, 25vw, 8rem)/1 Georgia, serif;
  text-shadow: 0 2px 12px #000;
}

.controls {
  display: flex;
  justify-content: center;
  gap: .75rem;
  flex-wrap: wrap;
}

.primary {
  border: 1px solid #fff;
  background: #713548;
  font-size: .85rem;
}

.primary:hover {
  background: #562536;
}

.primary:disabled {
  opacity: .65;
  cursor: wait;
}

.error {
  background: #562536;
  padding: .9rem;
  border-radius: .4rem;
  font-size: .85rem;
  line-height: 1.7;
}

.status {
  font-size: .8rem;
  line-height: 1.7;
}

.note {
  font-size: .7rem;
  line-height: 1.7;
}

footer {
  margin-top: 2rem;
  font-size: .6rem;
  text-transform: uppercase;
  line-height: 1.8;
  letter-spacing: .08em;
}
</style>
