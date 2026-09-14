<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { getRental } from '../data/properties'
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
const rental = await getRental(id)
const leadCapture = useLeadCapture(id, 'rental')

if (rental) {
  const description = truncate(rental.descripcion, 160)
  useHead({
    title: `${rental.titulo} — BairesRental`,
    meta: [
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: rental.titulo },
      { property: 'og:description', content: description },
      ...(rental.imagen ? [{ property: 'og:image', content: rental.imagen }] : []),
    ],
    link: [
      {
        rel: 'canonical',
        href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/departamentos/${rental.id}`,
      },
      ...hreflangLinks,
    ],
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Apartment',
          name: rental.titulo,
          description: rental.descripcion,
          address: rental.direccion || rental.barrio,
          image: rental.imagen || undefined,
          offers: {
            '@type': 'Offer',
            price: rental.precio || undefined,
            priceCurrency: rental.moneda,
            availability:
              rental.disponibilidad === 'disponible'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          },
        }),
      },
    ],
  })
} else {
  useHead({ title: 'Propiedad no encontrada — BairesRental', meta: [{ name: 'robots', content: 'noindex' }] })
}
</script>

<template>
  <SiteLayout>
    <main v-if="rental" class="br-detail container py-4">
      <p class="mb-3">
        <router-link :to="{ name: routeName('departamentos', currentLocale) }">{{ t('detail.backToRentals') }}</router-link>
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

          <form
            v-if="leadCapture.showCaptureForm.value"
            class="mt-2"
            style="max-width: 320px"
            @submit.prevent="leadCapture.submitAndGetWhatsappRedirect(whatsappUrl(rental.whatsappMsg || `Hola! Me interesa ${rental.titulo}`))"
          >
            <input v-model="leadCapture.name.value" type="text" required class="form-control mb-2" :placeholder="t('leadCapture.name')" />
            <input v-model="leadCapture.phone.value" type="tel" required class="form-control mb-2" :placeholder="t('leadCapture.phone')" />
            <button type="submit" class="btn btn-success btn-lg w-100" :disabled="leadCapture.submitting.value">
              {{ t('leadCapture.submit') }}
            </button>
          </form>
          <a
            v-else
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
      <p><router-link :to="{ name: routeName('departamentos', currentLocale) }">{{ t('detail.backToRentals') }}</router-link></p>
    </main>
  </SiteLayout>
</template>
