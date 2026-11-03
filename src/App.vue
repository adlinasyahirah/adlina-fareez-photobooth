<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import PhotoboothLanding from './components/PhotoboothLanding.vue'
import FrameSelectionScreen from './components/FrameSelectionScreen.vue'
import CameraPreviewScreen from './components/CameraPreviewScreen.vue'
import PhotoUploadScreen from './components/PhotoUploadScreen.vue'
import { weddingFrames } from './data/frames'

type ScreenHash = '#frames' | '#welcome' | '#camera' | '#upload'
const route = ref(window.location.hash)
const screen = ref<HTMLDivElement | null>(null)
const selectedFrameId = ref<string | null>(null)
const selectedFrame = computed(() => weddingFrames.find((frame) => frame.id === selectedFrameId.value))
const mode = ref<'camera' | 'upload'>(window.location.hash === '#upload' ? 'upload' : 'camera')

async function syncScreen(): Promise<void> {
  if (['#camera', '#upload'].includes(window.location.hash) && !selectedFrame.value) {
    window.history.replaceState(null, '', '#frames')
  }
  route.value = window.location.hash
  await nextTick()
  screen.value?.querySelector<HTMLElement>('h1')?.focus()
  window.scrollTo(0, 0)
}

function navigate(hash: ScreenHash): void {
  window.location.hash = hash
}

function start(nextMode: 'camera' | 'upload'): void {
  mode.value = nextMode
  navigate('#frames')
}

onMounted(() => {
  window.addEventListener('hashchange', syncScreen)
  if (route.value === '#camera' || route.value === '#upload') void syncScreen()
})
onBeforeUnmount(() => window.removeEventListener('hashchange', syncScreen))
</script>

<template>
  <div ref="screen">
    <CameraPreviewScreen v-if="route === '#camera' && selectedFrame" :frame="selectedFrame" @back="navigate('#frames')" />
    <PhotoUploadScreen v-else-if="route === '#upload' && selectedFrame" :frame="selectedFrame" @back="navigate('#frames')" />
    <FrameSelectionScreen v-else-if="route === '#frames'" v-model="selectedFrameId" :mode="mode" @back="navigate('#welcome')" @continue="navigate(mode === 'upload' ? '#upload' : '#camera')" />
    <PhotoboothLanding v-else @start="start" />
  </div>
</template>

<style>
/* Document defaults only; component presentation stays scoped. */
* { box-sizing: border-box; }
body { margin: 0; font-family: Georgia, 'Times New Roman', serif; }
</style>
