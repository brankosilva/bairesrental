<script setup lang="ts">
import { computed } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { SellerProfile } from '~/types/link'

// La página que el vendedor comparte.
//
// Antes /l/:code era un redirect 301 a la ficha pública. Tres problemas:
// el 301 lo cachea el navegador para siempre (o sea que a partir de la
// segunda apertura el servidor no se enteraba), el destinatario terminaba
// en una URL de catálogo de BairesRental con un ?ref= colgando, y no había
// forma de mostrarle quién se la mandó. Ahora renderiza acá.
//
// El conteo de aperturas NO está en esta página: lo hace
// server/middleware/01.link-open.ts, que ve la request real del visitante.
definePageMeta({ layout: 'branded' })

const route = useRoute()
const code = route.params.code as string

interface LinkPayload {
  code: string
  target: 'property' | 'catalog'
  recipientName: string | null
  seller: SellerProfile | null
  property: (RentalProperty & SaleProperty & { id: string }) | null
  propertyKind: 'rental' | 'sale' | null
  catalog: { rentals: (RentalProperty & { id: string })[]; sales: (SaleProperty & { id: string })[] } | null
}

const { data, error } = await useAsyncData(`link-${code}`, () => $fetch<LinkPayload>(`/api/l/${code}`))

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

// Mensaje pre-cargado de WhatsApp. Lleva el nombre del destinatario cuando
// el vendedor lo puso: así la atribución le llega DENTRO del chat, sin
// ningún código de tracking a la vista.
const contactMessage = computed(() => {
  const p = data.value?.property
  const quien = data.value?.recipientName ? `Soy ${data.value.recipientName}. ` : ''
  if (p) return `Hola! ${quien}Me interesa "${p.titulo}"${p.barrio ? ` en ${p.barrio}` : ''}.`
  return `Hola! ${quien}Vi tus propiedades y quería consultarte.`
})

const contactHref = computed(() => whatsappUrl(contactMessage.value, seller.value?.whatsapp))

// La página es privada y de un solo destinatario: nunca indexable, y el
// título no debe filtrar el nombre de esa persona.
useHead({
  title: () => (data.value?.property?.titulo ? `${data.value.property.titulo}` : 'Propiedades'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

// Un clic en contacto es la única señal de conversión que tiene el sistema.
// sendBeacon sobrevive a que el navegador se vaya a WhatsApp; el fetch con
// keepalive es el fallback. Nunca bloquea ni rompe la navegación.
function pingContact(propertyId?: string | null) {
  if (!import.meta.client) return
  const url = `/api/l/${code}/click${propertyId ? `?p=${encodeURIComponent(propertyId)}` : ''}`
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(url)
    else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    /* medir no puede romper el contacto */
  }
}

function onContact() {
  pingContact(data.value?.property?.id ?? null)
}

const rentals = computed(() => data.value?.catalog?.rentals ?? [])
const sales = computed(() => data.value?.catalog?.sales ?? [])
const catalogCount = computed(() => rentals.value.length + sales.value.length)
</script>

<template>
  <div v-if="error" class="br-brand-msg">
    <p>{{ (error as { statusCode?: number }).statusCode === 410 ? 'Este link ya no está activo.' : 'Este link no es válido.' }}</p>
  </div>

  <template v-else-if="data">
    <SellerBrandHeader
      :seller="seller"
      :contact-href="contactHref"
      :contact-label="contactLabel"
      @click="onContact"
    />

    <template v-if="data.target === 'property' && data.property">
      <RentalDetailBody
        v-if="data.propertyKind === 'rental'"
        :rental="data.property"
        :whatsapp-phone="seller?.whatsapp"
        :contact-label="contactLabel"
        hide-brand-badge
        @click="onContact"
      />
      <SaleDetailBody
        v-else-if="data.propertyKind === 'sale'"
        :sale="data.property"
        :whatsapp-phone="seller?.whatsapp"
        :contact-label="contactLabel"
        hide-brand-badge
        @click="onContact"
      />
    </template>

    <main v-else class="br-brand-catalog">
      <h1 class="br-brand-catalog-title">
        {{ catalogCount }} {{ catalogCount === 1 ? 'propiedad disponible' : 'propiedades disponibles' }}
      </h1>

      <div v-if="!catalogCount" class="br-brand-empty">No hay propiedades disponibles en este momento.</div>

      <div v-else class="br-brand-grid">
        <NuxtLink
          v-for="p in rentals"
          :key="`r-${p.id}`"
          :to="`/l/${code}/${encodeURIComponent(p.id)}`"
          class="br-brand-card"
        >
          <div class="br-brand-card-img">
            <img v-if="p.imagen" :src="p.imagen" :alt="p.titulo" loading="lazy" />
            <span v-else>📷</span>
          </div>
          <div class="br-brand-card-body">
            <span class="br-brand-card-loc">{{ [p.barrio, p.tipo].filter(Boolean).join(' · ') }}</span>
            <strong class="br-brand-card-title">{{ p.titulo }}</strong>
            <span class="br-brand-card-price">
              {{ p.precio ? `${p.moneda || 'USD'} ${Number(p.precio).toLocaleString('es-AR')}` : 'Consultar precio' }}
            </span>
          </div>
        </NuxtLink>

        <NuxtLink
          v-for="p in sales"
          :key="`s-${p.id}`"
          :to="`/l/${code}/${encodeURIComponent(p.id)}`"
          class="br-brand-card"
        >
          <div class="br-brand-card-img">
            <img v-if="p.fotos?.[0]" :src="p.fotos[0]" :alt="p.titulo" loading="lazy" />
            <span v-else>📷</span>
          </div>
          <div class="br-brand-card-body">
            <span class="br-brand-card-loc">{{ [p.barrio, p.tipo].filter(Boolean).join(' · ') }} · Venta</span>
            <strong class="br-brand-card-title">{{ p.titulo }}</strong>
            <span class="br-brand-card-price">
              {{ p.precio ? `${p.moneda || 'USD'} ${Number(p.precio).toLocaleString('es-AR')}` : 'Consultar precio' }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </main>
  </template>
</template>
