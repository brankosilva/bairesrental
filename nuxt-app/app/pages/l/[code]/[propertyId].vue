<script setup lang="ts">
import { computed } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { SellerProfile } from '~/types/link'

// Una ficha abierta DESDE un link de catálogo (/l/:code/:propertyId).
//
// Existe para que el cliente nunca salga de la página con la marca del
// vendedor: si las cards del catálogo apuntaran a /departamentos/:id, el
// primer clic lo devolvería al sitio de BairesRental, con el nav, los FABs
// y el WhatsApp de la empresa. Además así queda registrado QUÉ publicación
// miró, no sólo que abrió el link.
//
// El endpoint valida que la publicación sea de ese mismo vendedor; sin eso,
// /l/<code>/<id-ajeno> mostraría la propiedad de otro con este nombre y
// este WhatsApp encima.
definePageMeta({ layout: 'branded' })

const route = useRoute()
const code = route.params.code as string
const propertyId = route.params.propertyId as string

interface LinkPayload {
  code: string
  recipientName: string | null
  seller: SellerProfile | null
  property: (RentalProperty & SaleProperty & { id: string }) | null
  propertyKind: 'rental' | 'sale' | null
}

const { data, error } = await useAsyncData(`link-${code}-${propertyId}`, () =>
  $fetch<LinkPayload>(`/api/l/${code}`, { query: { p: propertyId } }),
)

// Sólo el status. Los headers (no-store, noindex) los pone
// server/middleware/01.link-open.ts, que corre para todo /l/* — incluidos
// los códigos inválidos, y sin depender de h3 desde el lado de la app.
//
// El status real importa: un 410 le dice al visitante que el link existió
// y se apagó, que no es lo mismo que uno inventado.
if (import.meta.server && error.value) {
  setResponseStatus(useRequestEvent()!, (error.value as { statusCode?: number }).statusCode ?? 404)
}

const seller = computed(() => data.value?.seller ?? null)
const firstName = computed(() => (seller.value?.displayName || '').split(/\s+/)[0] || '')
const contactLabel = computed(() => (firstName.value ? `Contactar a ${firstName.value}` : 'Contactar'))

const contactMessage = computed(() => {
  const p = data.value?.property
  const quien = data.value?.recipientName ? `Soy ${data.value.recipientName}. ` : ''
  return p ? `Hola! ${quien}Me interesa "${p.titulo}"${p.barrio ? ` en ${p.barrio}` : ''}.` : `Hola! ${quien}`
})

const contactHref = computed(() => whatsappUrl(contactMessage.value, seller.value?.whatsapp))

useHead({
  title: () => data.value?.property?.titulo || 'Propiedad',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

function onContact() {
  if (!import.meta.client) return
  const url = `/api/l/${code}/click?p=${encodeURIComponent(propertyId)}`
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(url)
    else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    /* medir no puede romper el contacto */
  }
}
</script>

<template>
  <div v-if="error" class="br-brand-msg">
    <p>{{ (error as { statusCode?: number }).statusCode === 410 ? 'Este link ya no está activo.' : 'Esta publicación no está disponible.' }}</p>
  </div>

  <template v-else-if="data?.property">
    <SellerBrandHeader
      :seller="seller"
      :contact-href="contactHref"
      :contact-label="contactLabel"
      @click="onContact"
    />

    <RentalDetailBody
      v-if="data.propertyKind === 'rental'"
      :rental="data.property"
      :back-to="`/l/${code}`"
      back-label="← Ver todas"
      :whatsapp-phone="seller?.whatsapp"
      :contact-label="contactLabel"
      hide-brand-badge
      @click="onContact"
    />
    <SaleDetailBody
      v-else
      :sale="data.property"
      :back-to="`/l/${code}`"
      back-label="← Ver todas"
      :whatsapp-phone="seller?.whatsapp"
      :contact-label="contactLabel"
      hide-brand-badge
      @click="onContact"
    />
  </template>
</template>
