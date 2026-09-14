<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { routeName } from '../router'
import { storeRefCode } from '../composables/useLeadCapture'

useHead({ title: 'BairesRental', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const router = useRouter()
const notFound = ref(false)

// This route is intentionally excluded from vite-ssg's prerendered route
// list (see src/router/index.ts) — codes are created dynamically by
// sellers long after any build, so there's nothing meaningful to
// pre-render. Firebase Hosting rewrites any /l/** request to the
// prerendered home page shell, and this component then resolves the
// *actual* browser URL client-side, same as a classic SPA fallback route.
onMounted(async () => {
  const code = route.params.code as string
  const { getFirestore, doc, getDoc } = await import('firebase/firestore')
  const { getFirebaseApp } = await import('../firebase/client')
  const snap = await getDoc(doc(getFirestore(getFirebaseApp()), 'links', code))

  if (!snap.exists() || snap.data()?.active === false) {
    notFound.value = true
    return
  }

  storeRefCode(code)
  const link = snap.data() as { propertyType?: 'rental' | 'sale'; propertyId?: string }

  if (link.propertyType === 'rental' && link.propertyId) {
    router.replace({ name: routeName('departamento-detail', 'es'), params: { id: link.propertyId }, query: { ref: code } })
  } else if (link.propertyType === 'sale' && link.propertyId) {
    router.replace({ name: routeName('venta-detail', 'es'), params: { id: link.propertyId }, query: { ref: code } })
  } else {
    router.replace({ name: routeName('departamentos', 'es'), query: { ref: code } })
  }
})
</script>

<template>
  <main class="container py-5 text-center">
    <p v-if="!notFound">Redirigiendo…</p>
    <p v-else>
      Este link no es válido o ya no está activo.
      <router-link :to="{ name: routeName('departamentos', 'es') }">Ver catálogo</router-link>
    </p>
  </main>
</template>
