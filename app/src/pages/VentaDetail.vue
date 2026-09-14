<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { getSale } from '../data/properties'
import { amenityLabel } from '../data/amenities'
import { formatPrice, whatsappUrl, truncate } from '../utils/format'
import SiteLayout from '../layouts/SiteLayout.vue'
import { routeName } from '../router'
import { useLocaleLinks } from '../i18n/useLocaleLinks'
import { useLeadCapture } from '../composables/useLeadCapture'

const route = useRoute()
const { t } = useI18n()
const { currentLocale, hreflangLinks } = useLocaleLinks()
const id = route.params.id as string
const sale = await getSale(id)
const leadCapture = useLeadCapture(id, 'sale')

if (sale) {
  const description = truncate(sale.descripcion, 160)
  useHead({
    title: `${sale.titulo} — BairesRental`,
    meta: [
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: sale.titulo },
      { property: 'og:description', content: description },
      ...(sale.fotos?.[0] ? [{ property: 'og:image', content: sale.fotos[0] }] : []),
    ],
    link: [
      { rel: 'canonical', href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/ventas/${sale.id}` },
      ...hreflangLinks,
    ],
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'RealEstateListing',
          name: sale.titulo,
          description: sale.descripcion,
          address: sale.direccion || sale.barrio,
          image: sale.fotos,
          floorSize: sale.superficie ? { '@type': 'QuantitativeValue', value: sale.superficie, unitCode: 'MTK' } : undefined,
          offers: {
            '@type': 'Offer',
            price: sale.precio || undefined,
            priceCurrency: sale.moneda,
            availability:
              sale.disponibilidad === 'disponible' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }),
      },
    ],
  })
} else {
  useHead({ title: 'Propiedad no encontrada — BairesRental', meta: [{ name: 'robots', content: 'noindex' }] })
}

const lightboxIndex = ref<number | null>(null)

function openLightbox(i: number) {
  lightboxIndex.value = i
}
function closeLightbox() {
  lightboxIndex.value = null
}
function next() {
  if (lightboxIndex.value === null || !sale) return
  lightboxIndex.value = (lightboxIndex.value + 1) % sale.fotos.length
}
function prev() {
  if (lightboxIndex.value === null || !sale) return
  lightboxIndex.value = (lightboxIndex.value - 1 + sale.fotos.length) % sale.fotos.length
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
  <SiteLayout>
    <main v-if="sale" class="br-detail container py-4">
      <p class="mb-3">
        <router-link :to="{ name: routeName('ventas', currentLocale) }">{{ t('detail.backToSales') }}</router-link>
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

          <form
            v-if="leadCapture.showCaptureForm.value"
            class="mt-2"
            style="max-width: 320px"
            @submit.prevent="leadCapture.submitAndGetWhatsappRedirect(whatsappUrl(sale.whatsappMsg || `Hola! Me interesa ${sale.titulo}`))"
          >
            <input v-model="leadCapture.name.value" type="text" required class="form-control mb-2" :placeholder="t('leadCapture.name')" />
            <input v-model="leadCapture.phone.value" type="tel" required class="form-control mb-2" :placeholder="t('leadCapture.phone')" />
            <button type="submit" class="btn btn-success btn-lg w-100" :disabled="leadCapture.submitting.value">
              {{ t('leadCapture.submit') }}
            </button>
          </form>
          <div class="d-flex gap-2 flex-wrap mt-2">
            <a
              v-if="!leadCapture.showCaptureForm.value"
              :href="whatsappUrl(sale.whatsappMsg || `Hola! Me interesa ${sale.titulo}`)"
              target="_blank"
              rel="noopener"
              class="btn btn-success btn-lg"
            >
              {{ t('detail.contactWhatsapp') }}
            </a>
            <a v-if="sale.fichaUrl" :href="sale.fichaUrl" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-lg">
              {{ t('detail.viewFullListing') }}
            </a>
          </div>
        </div>
      </div>

      <p class="mt-4">
        <router-link :to="{ name: routeName('ventas', currentLocale) }">{{ t('detail.backToSales') }}</router-link>
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
      <p><router-link :to="{ name: routeName('ventas', currentLocale) }">{{ t('detail.backToSales') }}</router-link></p>
    </main>
  </SiteLayout>
</template>
