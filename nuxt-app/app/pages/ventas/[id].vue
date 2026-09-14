<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { doc, getFirestore } from 'firebase/firestore'
import { useDocument } from 'vuefire'
import type { SaleProperty } from '~/types/property'

// Ported from app/src/pages/VentaDetail.vue. getSale(id) replaced by
// useDocument straight against `sales/{id}`. The lightbox's
// window.addEventListener('keydown', ...) is confirmed SSR-safe (it's
// inside onMounted/onUnmounted, same as the old file).
//
// Lead-capture-before-WhatsApp is deliberately NOT ported here — same
// reasoning as departamentos/[id].vue: app/src/composables/useLeadCapture.ts's
// localStorage guard is only accidentally SSR-safe under vite-ssg and
// belongs to a later milestone. Plain WhatsApp link for every visitor.
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const id = route.params.id as string

const db = getFirestore()
const sale = useDocument<SaleProperty>(doc(db, 'sales', id))

const description = computed(() => (sale.value ? truncate(sale.value.descripcion, 160) : ''))

useSeoMeta({
  title: () => (sale.value ? `${sale.value.titulo} — BairesRental` : 'Propiedad no encontrada — BairesRental'),
  description: () => description.value || undefined,
  ogType: 'website',
  ogTitle: () => sale.value?.titulo,
  ogDescription: () => description.value || undefined,
  ogImage: () => sale.value?.fotos?.[0] || undefined,
  robots: () => (sale.value ? undefined : 'noindex'),
})

useHead({
  script: () =>
    sale.value
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'RealEstateListing',
              name: sale.value.titulo,
              description: sale.value.descripcion,
              address: sale.value.direccion || sale.value.barrio,
              image: sale.value.fotos,
              floorSize: sale.value.superficie ? { '@type': 'QuantitativeValue', value: sale.value.superficie, unitCode: 'MTK' } : undefined,
              offers: {
                '@type': 'Offer',
                price: sale.value.precio || undefined,
                priceCurrency: sale.value.moneda,
                availability: sale.value.disponibilidad === 'disponible' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              },
            }),
          },
        ]
      : [],
})

const lightboxIndex = ref<number | null>(null)

function openLightbox(i: number) {
  lightboxIndex.value = i
}
function closeLightbox() {
  lightboxIndex.value = null
}
function next() {
  if (lightboxIndex.value === null || !sale.value) return
  lightboxIndex.value = (lightboxIndex.value + 1) % sale.value.fotos.length
}
function prev() {
  if (lightboxIndex.value === null || !sale.value) return
  lightboxIndex.value = (lightboxIndex.value - 1 + sale.value.fotos.length) % sale.value.fotos.length
}
function onKeydown(e: KeyboardEvent) {
  if (lightboxIndex.value === null) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowRight') next()
  if (e.key === 'ArrowLeft') prev()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <main v-if="sale" class="br-detail container py-4">
    <p class="mb-3">
      <NuxtLink :to="localePath('/ventas')">{{ t('detail.backToSales') }}</NuxtLink>
    </p>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="row g-2">
          <div class="col-8">
            <img
              v-if="sale.fotos?.[0]"
              :src="sale.fotos[0]"
              :alt="sale.titulo"
              class="img-fluid rounded-3 w-100"
              style="height: 320px; object-fit: cover; cursor: pointer"
              @click="openLightbox(0)"
            />
          </div>
          <div class="col-4">
            <div class="row g-2">
              <div v-for="(foto, i) in sale.fotos.slice(1, 5)" :key="i" class="col-6">
                <div class="position-relative" style="cursor: pointer" @click="openLightbox(i + 1)">
                  <img :src="foto" :alt="`${sale.titulo} ${i + 2}`" class="img-fluid rounded-2 w-100" style="height: 96px; object-fit: cover" />
                  <span
                    v-if="i === 3 && sale.fotos.length > 5"
                    class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center text-white fw-semibold rounded-2"
                    style="background: rgba(0, 0, 0, 0.55)"
                  >
                    +{{ sale.fotos.length - 5 }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button v-if="sale.fotos?.length" class="btn btn-outline-primary mt-3" @click="openLightbox(0)">
          {{ t('detail.seePhotos', { count: sale.fotos.length }) }}
        </button>
      </div>

      <div class="col-md-6">
        <span
          class="badge mb-2"
          :class="{
            'text-bg-success': sale.disponibilidad === 'disponible',
            'text-bg-warning': sale.disponibilidad === 'reservado',
            'text-bg-secondary': sale.disponibilidad === 'vendido',
          }"
        >
          {{ t(`disponibilidad.${sale.disponibilidad}`) }}
        </span>
        <span v-if="sale.esPropio" class="badge text-bg-primary mb-2 ms-1">★ BairesRental</span>
        <span v-if="sale.aptoCredito" class="badge text-bg-info mb-2 ms-1">{{ t('detail.mortgageEligible') }}</span>

        <h1 class="h3">{{ sale.titulo }}</h1>
        <p class="text-muted">{{ sale.barrio }} · {{ sale.tipo }}</p>
        <p class="fs-4 fw-semibold">{{ formatPrice(sale.precio, sale.moneda) }}</p>
        <p v-if="sale.expensas" class="text-muted small">{{ t('detail.expenses') }}: ARS {{ sale.expensas.toLocaleString('es-AR') }}</p>

        <p class="mt-3">{{ sale.descripcion }}</p>

        <ul class="list-unstyled row row-cols-2 g-2 my-3">
          <li>{{ t('detail.rooms') }}: {{ sale.ambientes ?? '—' }}</li>
          <li>{{ t('detail.totalArea') }}: {{ sale.superficie }} m²</li>
          <li v-if="sale.superficieCubierta">{{ t('detail.coveredArea') }}: {{ sale.superficieCubierta }} m²</li>
          <li>{{ t('detail.bathrooms') }}: {{ sale.banios ?? '—' }}</li>
          <li v-if="sale.antiguedad">{{ t('detail.age') }}: {{ sale.antiguedad }}</li>
          <li>{{ t('detail.furnished') }}: {{ sale.amueblado ? '✓' : '✗' }}</li>
        </ul>

        <div v-if="sale.amenities?.length" class="d-flex flex-wrap gap-2 mb-3">
          <span v-for="a in sale.amenities" :key="a" class="badge text-bg-light border">{{ amenityLabel(a) }}</span>
        </div>

        <p v-if="sale.direccion">
          📍 {{ sale.direccion }}
          <a v-if="sale.direccionUrl" :href="sale.direccionUrl" target="_blank" rel="noopener">{{ t('detail.viewOnMap') }}</a>
        </p>

        <!-- Lead-capture-before-WhatsApp deferred (see script comment) —
             plain WhatsApp link for every visitor in this milestone. -->
        <div class="d-flex gap-2 flex-wrap mt-2">
          <a :href="whatsappUrl(sale.whatsappMsg || `Hola! Me interesa ${sale.titulo}`)" target="_blank" rel="noopener" class="btn btn-success btn-lg">
            {{ t('detail.contactWhatsapp') }}
          </a>
          <a v-if="sale.fichaUrl" :href="sale.fichaUrl" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-lg">
            {{ t('detail.viewFullListing') }}
          </a>
        </div>
      </div>
    </div>

    <p class="mt-4">
      <NuxtLink :to="localePath('/ventas')">{{ t('detail.backToSales') }}</NuxtLink>
    </p>

    <div
      v-if="lightboxIndex !== null"
      class="br-lightbox position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style="background: rgba(0, 0, 0, 0.9); z-index: 1050"
      @click.self="closeLightbox"
    >
      <button class="btn btn-light position-absolute top-0 end-0 m-3" @click="closeLightbox">✕</button>
      <button class="btn btn-light position-absolute top-50 start-0 ms-3 translate-middle-y" @click="prev">‹</button>
      <img :src="sale.fotos[lightboxIndex]" :alt="`${sale.titulo} ${lightboxIndex + 1}`" style="max-height: 90vh; max-width: 90vw; object-fit: contain" />
      <button class="btn btn-light position-absolute top-50 end-0 me-3 translate-middle-y" @click="next">›</button>
      <span class="position-absolute bottom-0 mb-3 text-white">{{ lightboxIndex + 1 }} / {{ sale.fotos.length }}</span>
    </div>
  </main>

  <main v-else class="container py-5 text-center">
    <h1 class="h4">{{ t('detail.notFoundTitle') }}</h1>
    <p><NuxtLink :to="localePath('/ventas')">{{ t('detail.backToSales') }}</NuxtLink></p>
  </main>
</template>
