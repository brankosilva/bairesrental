<script setup lang="ts">
import { computed } from 'vue'
import { doc, getFirestore } from 'firebase/firestore'
import { useDocument } from 'vuefire'
import type { SaleProperty } from '~/types/property'

// Ported from app/src/pages/VentaDetail.vue for data fetching (useDocument
// straight against `sales/{id}`), but the *design* is a fresh port of the
// static site's detalle-venta.html — see departamentos/[id].vue's own
// comment for why neither earlier rewrite ever carried the branded layout
// over. Keeps this file's own pre-existing lightbox implementation (it
// already matched the static page's Esc/←/→ behavior) instead of also
// porting detalle-venta.html's imperative DOM version of the same thing.
//
// Lead-capture-before-WhatsApp is deliberately NOT ported here — same
// reasoning as departamentos/[id].vue.
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const id = route.params.id as string

const db = getFirestore()
const sale = useDocument<SaleProperty>(doc(db, 'sales', id))

// Ídem departamentos/[id].vue: una publicación sin aprobar no la lee un
// anónimo, y el rechazo de firestore.rules hace REchazar a `promise`. Sin el
// catch el SSR contesta 500 en vez de 404. Un admin logueado sí la abre — es
// como la revisa antes de aprobarla — y de eso se ocupa el noindex de abajo.
await sale.promise.value.catch(() => {})
if (!sale.value) {
  throw createError({ statusCode: 404, statusMessage: 'Propiedad no encontrada' })
}

const description = computed(() => (sale.value ? truncate(metaText(sale.value.descripcion), 160) : ''))

// fotos[0] es la portada. Igual que en alquileres, va el derivado 1200x630 y
// no la foto cruda — ver utils/ogImage.ts.
const og = computed(() => ogImage(sale.value?.fotos?.[0]))

useSeoMeta({
  title: () => (sale.value ? `${sale.value.titulo} — BairesRental` : 'Propiedad no encontrada — BairesRental'),
  description: () => description.value || undefined,
  ogType: 'website',
  ogSiteName: 'BairesRental',
  ogTitle: () => sale.value?.titulo,
  ogDescription: () => description.value || undefined,
  ogImage: () => og.value?.url,
  ogImageWidth: () => og.value?.width,
  ogImageHeight: () => og.value?.height,
  ogImageType: () => og.value?.type,
  ogImageAlt: () => sale.value?.titulo,
  twitterCard: () => (og.value ? 'summary_large_image' : 'summary'),
  twitterTitle: () => sale.value?.titulo,
  twitterDescription: () => description.value || undefined,
  twitterImage: () => og.value?.url,
  robots: () => (sale.value && estaPublicada(sale.value) ? undefined : 'noindex'),
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

// El cuerpo de la ficha (galería + lightbox incluidos) vive en
// components/SaleDetailBody.vue desde que también lo usa la página con la
// marca del vendedor (/l/:code). Esta página conserva fetch, SEO/OG, JSON-LD
// y el caso "no encontrado".
//
// Las ventas no tienen modo vendedor (?vendor=1): nunca lo tuvieron — el
// catalogo-vendedores.html del sitio viejo era sólo de alquileres.
const backTo = computed(() => localePath('/ventas'))
</script>

<template>
  <SaleDetailBody v-if="sale" :sale="sale" :back-to="backTo" />

  <main v-else class="container py-5 text-center">
    <h1 class="h4">{{ t('detail.notFoundTitle') }}</h1>
    <p><NuxtLink :to="backTo">{{ t('detail.backToSales') }}</NuxtLink></p>
  </main>
</template>
