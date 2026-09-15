<script setup lang="ts">
import { computed } from 'vue'
import { doc, getFirestore } from 'firebase/firestore'
import { useDocument } from 'vuefire'
import type { RentalProperty } from '~/types/property'

// Ported from app/src/pages/DepartamentoDetail.vue's data fetching (see
// that file's own comment history), but the *design* is a fresh port of
// the static site's departamento.html — neither the old vite-ssg app nor
// the first Nuxt milestone ever carried over its hero/map/características
// layout, they both shipped a generic two-column Bootstrap body instead.
//
// Lead-capture-before-WhatsApp (app/src/composables/useLeadCapture.ts) is
// deliberately NOT ported here — per the earlier milestone's brief, its
// localStorage guard is only accidentally SSR-safe under vite-ssg and
// belongs to a later milestone once auth/leads are ported properly. This
// page always shows the plain WhatsApp link.
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const id = route.params.id as string

const db = getFirestore()
const rental = useDocument<RentalProperty>(doc(db, 'rentals', id))

const description = computed(() => (rental.value ? truncate(metaText(rental.value.descripcion), 160) : ''))

// La portada cruda (foto de celular vertical, ~2 MB) no sirve como preview:
// ver el comentario de utils/ogImage.ts. Esto apunta al derivado 1200x630.
const og = computed(() => ogImage(rental.value?.imagen))

useSeoMeta({
  title: () => (rental.value ? `${rental.value.titulo} — BairesRental` : 'Propiedad no encontrada — BairesRental'),
  description: () => description.value || undefined,
  ogType: 'website',
  ogSiteName: 'BairesRental',
  ogTitle: () => rental.value?.titulo,
  ogDescription: () => description.value || undefined,
  ogImage: () => og.value?.url,
  // Declarar medidas y mime hace que Facebook/LinkedIn dibujen la tarjeta en
  // el primer pegado, sin esperar a bajar y medir la imagen.
  ogImageWidth: () => og.value?.width,
  ogImageHeight: () => og.value?.height,
  ogImageType: () => og.value?.type,
  ogImageAlt: () => rental.value?.titulo,
  // Sin twitterCard, X/Slack/Discord muestran una tarjeta chica o directamente
  // ninguna, aunque los og:* estén completos.
  twitterCard: () => (og.value ? 'summary_large_image' : 'summary'),
  twitterTitle: () => rental.value?.titulo,
  twitterDescription: () => description.value || undefined,
  twitterImage: () => og.value?.url,
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

// Modo vendedor (?vendor=1): es el equivalente de ficha-vendedor.html — misma
// ficha pero sin WhatsApp, y el "Volver al catálogo" mantiene el flag.
const { isVendor, vendorLink } = useVendorMode()

// El cuerpo de la ficha vive en components/RentalDetailBody.vue desde que
// también lo usa la página con la marca del vendedor (/l/:code). Esta página
// conserva lo que es suyo: fetch, SEO/OG, JSON-LD y el caso "no encontrado".
const backTo = computed(() => vendorLink(localePath('/departamentos')))
</script>

<template>
  <RentalDetailBody
    v-if="rental"
    :rental="rental"
    :back-to="backTo"
    :hide-whatsapp="isVendor"
  />

  <main v-else class="container py-5 text-center">
    <h1 class="h4">{{ t('detail.notFoundTitle') }}</h1>
    <p><NuxtLink :to="backTo">{{ t('detail.backToRentals') }}</NuxtLink></p>
  </main>
</template>
