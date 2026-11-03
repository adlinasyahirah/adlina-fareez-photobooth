<script setup lang="ts">
import FloralSprig from './FloralSprig.vue'

defineEmits<{ back: [] }>()
</script>

<template>
  <main class="placeholder" aria-labelledby="frame-title">
    <section class="card">
      <FloralSprig class="floral" />
      <p class="eyebrow">A MEMORY TO KEEP</p>
      <h1 id="frame-title" tabindex="-1">Frame Selection</h1>
      <p class="description">A lovely frame for your lovely moment.<br />This screen is coming in the next phase.</p>
      <button type="button" @click="$emit('back')">Back to Welcome</button>
      <footer>Coded with love by the bride ♡</footer>
    </section>
  </main>
</template>

<style scoped>
.placeholder { min-height: 100svh; display: grid; place-items: center; padding: 1rem; background: #fff url('../assets/Background.jpeg') center / cover no-repeat; color: #713548; }
.card { width: min(100%, 36rem); padding: 2rem 1.25rem; border: 1px solid #ad7c7466; background: #fff; text-align: center; }
.floral { width: 6rem; height: 8rem; margin-inline: auto; }
.eyebrow { font: .65rem Arial, sans-serif; letter-spacing: .2em; }
h1 { font-size: clamp(2rem, 8vw, 3rem); font-weight: 400; margin-block: 1rem; }
.description { color: #785c62; line-height: 1.8; }
button { min-height: 3rem; padding: .8rem 1.3rem; margin-top: 1rem; border: 1px solid #713548; border-radius: 3px; background: #713548; color: #fffaf3; font: inherit; cursor: pointer; }
button:hover { background: #562536; }
button:focus-visible { outline: 3px solid #713548; outline-offset: 5px; }
footer { margin-top: 3rem; font-size: .75rem; color: #785c62; }
</style>
