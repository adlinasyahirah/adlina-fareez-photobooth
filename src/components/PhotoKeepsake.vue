<script setup lang="ts">
import photostrips from '../assets/SyirasPhotostrips.png'
</script>

<template>
  <figure class="keepsake">
    <img :src="photostrips" alt="Photostrip kenangan Adlina Syahirah dan Fareez Fahmi" width="1080" height="1350" />
  </figure>
</template>

<style scoped>
.keepsake { width: min(85%, 13rem); margin: 1.75rem auto 0; transform: rotate(-3deg); }
img { display: block; width: 100%; height: auto; border-radius: .35rem; box-shadow: 0 6px 18px rgb(71 43 39 / 12%); }
</style>
