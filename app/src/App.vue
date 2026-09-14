<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'

const route = useRoute()
useHead({
  htmlAttrs: { lang: computed(() => (route.meta.locale as string) || 'es') },
})
</script>

<template>
  <!-- Page components use top-level `await` in `<script setup>` to fetch
       Firestore data (see src/data/properties.ts) before rendering — that
       requires the async component to resolve inside a <Suspense> boundary,
       both during the vite-ssg prerender pass and after client hydration. -->
  <Suspense>
    <router-view />
  </Suspense>
</template>
