<script setup lang="ts">
import { computed, ref } from 'vue'
import { weddingFrames, type PhotoCount } from '../data/frames'

const props = defineProps<{ modelValue: string | null; mode: 'camera' | 'upload' }>()
const emit = defineEmits<{
  back: []
  continue: []
  'update:modelValue': [value: string | null]
}>()
const selectedFrame = computed(() => weddingFrames.find((frame) => frame.id === props.modelValue))
const photoCount = ref<PhotoCount>(selectedFrame.value?.photoCount ?? 1)
const visibleFrames = computed(() => weddingFrames.filter((frame) => frame.photoCount === photoCount.value))
const photoCounts = [1, 2, 3] as const

function changePhotoCount(count: PhotoCount): void {
  photoCount.value = count
  emit('update:modelValue', null)
}
</script>

<template>
  <main class="selection" aria-labelledby="frame-title">
    <div class="content">
      <header>
        <button class="back" type="button" aria-label="Back to welcome" @click="$emit('back')"><span
            aria-hidden="true">←</span> Back</button>
        <h1 id="frame-title" tabindex="-1">Choose Your Keepsake</h1>
        <p class="intro">Find your favourite look.</p>
      </header>

      <fieldset class="layouts">
        <legend>Choose your strip layout</legend>
        <div class="layout-options">
          <label v-for="count in photoCounts" :key="count" class="layout-option">
            <input type="radio" name="photo-count" :value="count" :checked="photoCount === count"
              @change="changePhotoCount(count)" />
            <span>{{ count }} {{ count === 1 ? 'strip' : 'strips' }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="frames">
        <legend>Choose a design</legend>
        <div class="frame-grid">
          <label v-for="frame in visibleFrames" :key="frame.id" class="frame-option">
            <input type="radio" name="wedding-frame" :value="frame.id" :checked="modelValue === frame.id"
              @change="emit('update:modelValue', frame.id)" />
            <span class="frame-card">
              <img :src="frame.image" alt="" loading="lazy" />
              <span class="frame-name">{{ frame.name }}</span>
              <span class="selection-label">{{ modelValue === frame.id ? 'Selected' : 'Select' }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <p class="status" role="status">{{ selectedFrame ? `${selectedFrame.name} · ${selectedFrame.photoCount}
        ${selectedFrame.photoCount === 1 ? 'photo' : 'photos'} selected` : 'Select a design to see your strip preview.'
        }}</p>
      <section v-if="selectedFrame" class="preview" aria-labelledby="preview-title">
        <h2 id="preview-title">Your strip</h2>
        <img :src="selectedFrame.image"
          :alt="`${selectedFrame.name}, ${selectedFrame.photoCount}-photo strip preview`" />
        <button class="continue" type="button" @click="$emit('continue')">Use this strip</button>
      </section>
      <footer>Designed &amp; developed by the bride, Syira ♡</footer>
    </div>
  </main>
</template>

<style scoped>
.continue { display: block; min-height: 2.75rem; margin: 1.25rem auto 0; padding: .75rem 1.25rem; background: #713548; color: #fff; border: 1px solid #fff; border-radius: .5rem; font: inherit; font-size: .85rem; cursor: pointer; }
.continue:hover { background: #562536; }
.continue:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
@font-face {
  font-family: 'Great Vibes';
  src: url('../assets/fonts/GreatVibes-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

.selection {
  min-height: 100svh;
  padding: 1.25rem 1rem;
  color: #fff;
  background: url('../assets/Background.jpeg') center / cover no-repeat;
  font-family: Georgia, 'Times New Roman', serif;
  text-shadow: 0 2px 5px rgb(0 0 0 / 75%);
}

.content {
  width: min(100%, 46rem);
  margin-inline: auto;
}

header {
  text-align: center;
}

.back {
  display: flex;
  align-items: center;
  gap: .5rem;
  min-height: 2.75rem;
  margin: 0 0 1rem;
  padding: .5rem .25rem;
  color: #fff;
  background: transparent;
  border: 0;
  border-radius: .2rem;
  font: inherit;
  font-size: .8rem;
  text-shadow: inherit;
  cursor: pointer;
}

.back span {
  font-size: 1.2rem;
}

.back:hover {
  text-decoration: underline;
  text-underline-offset: .25rem;
}

.back:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

.eyebrow {
  margin: 1.5rem 0 .75rem;
  font-size: .7rem;
  line-height: 1.6;
  letter-spacing: .1em;
}

h1 {
  margin: 0;
  font: 400 clamp(2.3rem, 9vw, 3.5rem)/1.3 'Great Vibes', cursive;
}

.intro {
  font-size: .85rem;
  line-height: 1.7;
  margin: .5rem 0 1.5rem;
}

fieldset {
  padding: 0;
  border: 0;
  margin: 1.5rem 0;
  min-width: 0;
}

legend {
  width: 100%;
  text-align: center;
  font-size: .85rem;
  letter-spacing: .04em;
  margin-bottom: .9rem;
}

.layout-options {
  display: flex;
  justify-content: center;
  gap: .6rem;
}

.layout-option,
.frame-option {
  position: relative;
  display: block;
  cursor: pointer;
}

input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.layout-option>span {
  display: grid;
  place-items: center;
  min-height: 2.75rem;
  padding: .5rem .8rem;
  border: 1px solid #fff;
  border-radius: .5rem;
  background: rgb(0 0 0 / 35%);
  font-size: .85rem;
}

.layout-option input:checked+span {
  background: #713548;
}

input:focus-visible+span {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

.frame-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .6rem;
}

.frame-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .6rem;
  height: 100%;
  padding: .55rem .35rem;
  background: rgb(0 0 0 / 45%);
  border: 2px solid transparent;
  border-radius: .65rem;
  text-align: center;
}

.frame-option input:checked+.frame-card {
  border-color: #fff;
  background: #713548;
}

.frame-card img {
  display: block;
  width: 100%;
  height: 10rem;
  object-fit: contain;
}

.frame-name {
  font-size: .75rem;
  line-height: 1.5;
}

.selection-label {
  margin-top: auto;
  font-size: .65rem;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.status {
  min-height: 2.5rem;
  text-align: center;
  font-size: .8rem;
  line-height: 1.6;
}

.preview {
  text-align: center;
  margin-top: 1rem;
}

h2 {
  font-size: 1rem;
  font-weight: 400;
}

.preview img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 28rem;
  margin: 0 auto;
}

.preview p {
  font-size: .75rem;
  line-height: 1.7;
}

footer {
  margin-top: 2.5rem;
  text-align: center;
  font-size: .6rem;
  line-height: 1.8;
  letter-spacing: .08em;
  text-transform: uppercase;
}

@media (min-width: 40rem) {
  .frame-grid {
    gap: 1rem;
  }

  .frame-card {
    padding: 1rem;
  }

  .frame-card img {
    height: 15rem;
  }

  .frame-name {
    font-size: .9rem;
  }
}
</style>
