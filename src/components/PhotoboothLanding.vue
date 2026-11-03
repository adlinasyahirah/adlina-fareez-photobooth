<script setup lang="ts">
import PhotoKeepsake from './PhotoKeepsake.vue'

defineEmits<{ start: [mode: 'camera' | 'upload'] }>()
</script>

<template>
  <main class="landing">
    <header class="wedding-header">
        <p class="couple">Adlina Syahirah &amp; Fareez Fahmi</p>
        <p class="date"><time datetime="2026-11-21">21 November 2026</time></p>
    </header>
    <section class="welcome" aria-labelledby="photobooth-title">
      <div class="photobooth-content">
      <PhotoKeepsake />
      <h1 id="photobooth-title" tabindex="-1">Digital Photobooth</h1>
      <p class="intro">A little photo souvenir from our wedding.</p>
      <div class="actions">
        <button class="button button--primary" type="button" @click="$emit('start', 'camera')">Use Camera</button>
        <button class="button button--secondary" type="button" @click="$emit('start', 'upload')">Upload Photos</button>
      </div>
      </div>
    </section>
    <footer>Designed &amp; developed by the bride, Syira ♡</footer>
  </main>
</template>

<style scoped>
@font-face {
  font-family: 'Great Vibes';
  src: url('../assets/fonts/GreatVibes-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

.landing {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
  text-align: center;
  text-shadow: 0 2px 5px rgb(0 0 0 / 65%);
  background: url('../assets/Background.jpeg') center / cover no-repeat;
  color: #fff;
  font-family: Arial, Helvetica, sans-serif;
}

.welcome {
  width: min(100%, 26rem);
  flex: 1;
  display: grid;
  align-items: center;
  padding: 1.5rem 0;
  text-align: center;
  text-shadow: 0 2px 5px rgb(0 0 0 / 65%);
}

.photobooth-content {
  transform: translateY(-1rem);
}

.wedding-header {
  margin-top: 1.5rem;
  transform: translateY(clamp(2rem, calc(8svh - 1.5rem), 3.5rem));
}

.wedding-header, footer {
  width: min(100%, 26rem);
  flex-shrink: 0;
}

.couple,
.date {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: normal;
}

.couple {
  color: #fff;
  font-size: clamp(1rem, 4vw, 1.2rem);
}

.date {
  margin-top: .65rem;
  color: #fff;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: .75rem;
  text-transform: uppercase;
  letter-spacing: .14em;
}

.couple, .intro, footer {
  font-family: Georgia, 'Times New Roman', serif;
  text-transform: uppercase;
  letter-spacing: .1em;
}

h1 {
  margin: 1.25rem 0 .75rem;
  font-family: 'Great Vibes', cursive;
  font-size: clamp(2.3rem, 9.5vw, 3.2rem);
  line-height: 1.3;
  font-weight: 400;
}

.intro {
  margin: 0;
  color: #fff;
  font-size: .7rem;
  line-height: 1.7;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: .5rem;
  margin-top: .75rem;
}

.button {
  min-height: 2.75rem;
  padding: .6rem .75rem;
  border: 1px solid #fff;
  border-radius: .55rem;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: .75rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: .1em;
  line-height: 1.4;
  cursor: pointer;
}

.button--primary {
  background: #713548;
  color: #fff;
}

.button--secondary {
  background: transparent;
  color: #fff;
}

.button--primary:hover {
  background: #562536;
}

.button--secondary:hover {
  background: rgb(255 255 255 / 15%);
}

.button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

footer {
  margin: 0;
  font-size: .6rem;
  font-style: normal;
  line-height: 1.6;
  color: #fff;
}

@media (min-width: 48rem) {
  .welcome {
    padding: 2rem 0;
  }
}
</style>
