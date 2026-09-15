<script setup lang="ts">
// Layout de las páginas que comparte un vendedor (/l/:code).
//
// Existe para NO heredar nada de layouts/default.vue: ese trae el nav de
// BairesRental, el selector ES/EN, los FABs de WhatsApp e Instagram y el
// pie con la marca. Acá no va nada de eso — la decisión para esta tanda es
// que la página se presente como del vendedor, sin marca de BairesRental.
//
// Tampoco lleva selector de idioma: es un envío uno-a-uno y el vendedor ya
// sabe en qué idioma habla su cliente.
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
  link: [{ rel: 'stylesheet', href: '/css/br-brand.css' }],
})
</script>

<template>
  <div class="br-brand-page">
    <slot />
  </div>
</template>
