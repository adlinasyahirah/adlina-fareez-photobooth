<script setup lang="ts">
import { ref } from 'vue'
import type { WeddingFrame } from '../data/frames'
import type { CapturedPhoto } from '../utils/photoCapture'
import FinishedStripPreview from './FinishedStripPreview.vue'

defineProps<{ frame: WeddingFrame; photos: CapturedPhoto[]; source?: 'camera' | 'upload' }>()
const emit = defineEmits<{ retake: [index: number]; restart: []; back: [] }>()
const isAlbumSaving = ref(false)
const leaveDialog = ref<HTMLDialogElement | null>(null)
const pendingAction = ref<'restart' | 'back' | null>(null)

function requestLeave(action: 'restart' | 'back'): void {
  if (isAlbumSaving.value) return
  pendingAction.value = action
  leaveDialog.value?.showModal()
}

function stayAndSave(): void {
  pendingAction.value = null
  leaveDialog.value?.close()
}

function continueLeaving(): void {
  const action = pendingAction.value
  pendingAction.value = null
  leaveDialog.value?.close()
  if (action === 'restart') emit('restart')
  else if (action === 'back') emit('back')
}
</script>

<template>
  <section class="review" aria-labelledby="review-title">
    <h1 id="review-title" tabindex="-1">That's a Wrap!</h1>
    <p class="description">Love these shots, or fancy another round?</p>
    <FinishedStripPreview :frame="frame" :photos="photos" @album-saving="isAlbumSaving = $event" />
    <div class="actions">
      <button class="primary" type="button" :disabled="isAlbumSaving" @click="requestLeave('restart')">{{ source === 'upload' ? 'Choose new photos' : 'Take new photos' }}</button>
      <button type="button" :disabled="isAlbumSaving" @click="requestLeave('back')">Choose another strip</button>
    </div>
    <p class="note">Save a copy of your keepsake before leaving or refreshing. This page will reset when you leave.</p>
    <dialog ref="leaveDialog" class="leave-dialog" aria-labelledby="leave-title" aria-describedby="leave-description"
      @cancel="pendingAction = null" @close="pendingAction = null">
      <h2 id="leave-title">Save your keepsake first ♡</h2>
      <p id="leave-description">Photos on this page will disappear when you start again or choose another strip. Please
        download or save your strip before continuing.</p>
      <div class="dialog-actions">
        <button class="primary" type="button" autofocus @click="stayAndSave">Go back &amp; save</button>
        <button type="button" @click="continueLeaving">Continue anyway</button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.leave-dialog {
  width: min(calc(100% - 2rem), 25rem);
  max-height: calc(100svh - 2rem);
  overflow-y: auto;
  padding: 1.5rem;
  border: 0;
  border-radius: 1rem;
  background: #fff;
  color: #713548;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
  text-shadow: none;
}

.leave-dialog::backdrop {
  background: rgb(0 0 0 / 65%);
}

.leave-dialog h2 {
  margin: 0 0 .8rem;
  font-size: 1.25rem;
  font-weight: 400;
  line-height: 1.5;
}

.leave-dialog p {
  font-size: .85rem;
  line-height: 1.8;
}

.dialog-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: .6rem;
  margin-top: 1.25rem;
}

.dialog-actions button {
  color: #713548;
  border-color: #713548;
}

.dialog-actions .primary {
  color: #fff;
}

.dialog-actions button:disabled {
  opacity: .6;
  cursor: wait;
}

button:hover {
  background: #f4e8eb;
}

.dialog-actions .primary:hover {
  background: #562536;
}

.dialog-actions button:focus-visible {
  outline-color: #713548;
}

h1 {
  font: 400 clamp(2.3rem, 9vw, 3.2rem)/1.3 'Great Vibes', cursive;
  margin: 1rem 0 .5rem;
}

.description,
.note {
  font-size: .8rem;
  line-height: 1.8;
}

button {
  min-height: 2.75rem;
  padding: .65rem .9rem;
  border: 1px solid #fff;
  border-radius: .4rem;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: .8rem;
  cursor: pointer;
}

button:disabled {
  opacity: .6;
  cursor: wait;
}

button:hover {
  background: #562536;
}

button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.actions {
  display: flex;
  justify-content: center;
  gap: .75rem;
  flex-wrap: wrap;
}

.primary {
  background: #713548;
}

.note {
  margin-top: 1.5rem;
  font-size: .7rem;
}
</style>
