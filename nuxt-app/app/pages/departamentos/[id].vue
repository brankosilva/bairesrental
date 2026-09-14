<script setup lang="ts">
import { computed } from 'vue'
import { doc, getFirestore } from 'firebase/firestore'
import { useDocument } from 'vuefire'
import type { RentalProperty } from '~/types/property'

// Ported from app/src/pages/DepartamentoDetail.vue. getRental(id) (the old
// SSR-admin-SDK/client-SDK one-time fetch split) is replaced by
// useDocument straight against the `rentals/{id}` doc — same composable
// confirmed working for real per-request SSR in N0's spike page.
//
// Lead-capture-before-WhatsApp (app/src/composables/useLeadCapture.ts) is
// deliberately NOT ported here — per this milestone's brief, its
// localStorage guard is only accidentally SSR-safe under vite-ssg (a
// thrown ReferenceError happens to get swallowed by a bare try/catch,
// which nothing here should rely on under real Nuxt SSR) and belongs to a
// later milestone once auth/leads are ported properly. This page always
// shows the plain WhatsApp link.
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const id = route.params.id as string

const db = getFirestore()
const rental = useDocument<RentalProperty>(doc(db, 'rentals', id))

const description = computed(() => (rental.value ? truncate(rental.value.descripcion, 160) : ''))

useSeoMeta({
  title: () => (rental.value ? `${rental.value.titulo} — BairesRental` : 'Propiedad no encontrada — BairesRental'),
  description: () => description.value || undefined,
  ogType: 'website',
  ogTitle: () => rental.value?.titulo,
  ogDescription: () => description.value || undefined,
  ogImage: () => rental.value?.imagen || undefined,
  robots: () => (rental.value ? undefined : 'noindex'),
})

useHead({
  script: () =>
    rental.value
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Apartment',
              name: rental.value.titulo,
              description: rental.value.descripcion,
              address: rental.value.direccion || rental.value.barrio,
              image: rental.value.imagen || undefined,
              offers: {
                '@type': 'Offer',
                price: rental.value.precio || undefined,
                priceCurrency: rental.value.moneda,
                availability:
                  rental.value.disponibilidad === 'disponible' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              },
            }),
          },
        ]
      : [],
})
</script>

<template>
  <main v-if="rental" class="br-detail container py-4">
    <p class="mb-3">
      <NuxtLink :to="localePath('/departamentos')">{{ t('detail.backToRentals') }}</NuxtLink>
    </p>

    <div class="row g-4">
      <div class="col-md-6">
        <img
          v-if="rental.imagen"
          :src="rental.imagen"
          :alt="rental.titulo"
          class="img-fluid rounded-3 w-100"
          style="object-fit: cover; max-height: 420px"
        />
        <div v-else class="br-no-image d-flex align-items-center justify-content-center rounded-3" style="height: 420px; background: var(--gris, #f4f4f6)">
          📸
        </div>
        <a v-if="rental.fotos" :href="rental.fotos" target="_blank" rel="noopener" class="btn btn-outline-primary mt-3">
          {{ t('detail.seeAllPhotos') }}
        </a>
      </div>

      <div class="col-md-6">
        <span
          class="badge mb-2"
          :class="{
            'text-bg-success': rental.disponibilidad === 'disponible',
            'text-bg-warning': rental.disponibilidad === 'reservado',
            'text-bg-secondary': rental.disponibilidad === 'no disponible',
          }"
        >
          {{ t(`disponibilidad.${rental.disponibilidad}`) }}
        </span>
        <span v-if="rental.esPropio" class="badge text-bg-primary mb-2 ms-1">★ BairesRental</span>

        <h1 class="h3">{{ rental.titulo }}</h1>
        <p class="text-muted">{{ rental.barrio }} · {{ rental.tipo }}</p>
        <p class="fs-4 fw-semibold">
          {{ formatPrice(rental.precio, rental.moneda) }}<span v-if="rental.precio"> {{ t('departamentos.perMonth') }}</span>
        </p>
        <p v-if="rental.disponibleDesde" class="badge text-bg-light border">
          {{ t('detail.availableFrom', { date: rental.disponibleDesde }) }}
        </p>

        <p class="mt-3">{{ rental.descripcion }}</p>

        <ul class="list-unstyled row row-cols-2 g-2 my-3">
          <li>{{ t('detail.furnished') }}: {{ rental.amueblado ? t('detail.yes') : t('detail.no') }}</li>
          <li>{{ t('detail.petsAllowed') }}: {{ rental.mascotas ? t('detail.yes') : t('detail.no') }}</li>
          <li>{{ rental.serviciosIncluidos ? t('detail.servicesIncluded') : t('detail.servicesNotIncluded') }}</li>
          <li>{{ t('detail.minStay') }}: {{ rental.minimoMeses }} {{ rental.minimoMeses === 1 ? t('detail.month') : t('detail.months') }}</li>
        </ul>

        <div v-if="rental.amenities?.length" class="d-flex flex-wrap gap-2 mb-3">
          <span v-for="a in rental.amenities" :key="a" class="badge text-bg-light border">{{ amenityLabel(a) }}</span>
        </div>

        <p v-if="rental.direccion">
          📍 {{ rental.direccion }}
          <a v-if="rental.direccionUrl" :href="rental.direccionUrl" target="_blank" rel="noopener">{{ t('detail.viewOnMap') }}</a>
        </p>

        <!-- Lead-capture-before-WhatsApp deferred (see script comment) —
             plain WhatsApp link for every visitor in this milestone. -->
        <a
          :href="whatsappUrl(rental.whatsappMsg || `Hola! Me interesa ${rental.titulo}`)"
          target="_blank"
          rel="noopener"
          class="btn btn-success btn-lg mt-2"
        >
          {{ t('detail.whatsapp') }}
        </a>
      </div>
    </div>
  </main>

  <main v-else class="container py-5 text-center">
    <h1 class="h4">{{ t('detail.notFoundTitle') }}</h1>
    <p><NuxtLink :to="localePath('/departamentos')">{{ t('detail.backToRentals') }}</NuxtLink></p>
  </main>
</template>
