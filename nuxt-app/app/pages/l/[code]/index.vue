<script setup lang="ts">
import { computed, onMounted } from 'vue'
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
// La apertura SÍ se cuenta desde acá (pingLinkOpen), porque el id del
// visitante vive en su localStorage: el middleware no lo ve, y contar por
// request convertía una sola persona recargando en cinco aperturas. Ver
// app/utils/linkVisitor.ts.
definePageMeta({ layout: 'branded' })

const route = useRoute()
const code = route.params.code as string

interface LinkPayload {
  code: string
  target: 'property' | 'catalog'
  seller: SellerProfile | null
  sellerFallback: boolean
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

// Mensaje pre-cargado de WhatsApp. NO lleva el nombre con el que el vendedor
// etiquetó el link: el campo "Para quién" es su anotación interna —ahí pone
// "Juan del Once", "consulta de Instagram" o lo que le sirva para reconocer
// la fila en su tabla— y eso, pegado como "Soy …" en el chat, le llega tal
// cual al destinatario. Que se presente solo.
const contactMessage = computed(() => {
  const p = data.value?.property
  if (p) return `Hola! Me interesa "${p.titulo}"${p.barrio ? ` en ${p.barrio}` : ''}.`
  return 'Hola! Vi tus propiedades y quería consultarte.'
})

const contactHref = computed(() => whatsappUrl(contactMessage.value, seller.value?.whatsapp))

// Título, descripción y preview del link (og:*/twitter:*), con la identidad
// del vendedor adentro. La página es privada y de un solo destinatario, así
// que sigue siendo noindex y ningún meta lleva el nombre de esa persona — el
// detalle está en el composable.
useSharedLinkSeo(() => data.value ?? null)

// Un clic en contacto es la única señal de conversión que tiene el sistema.
// sendBeacon sobrevive a que el navegador se vaya a WhatsApp; el fetch con
// keepalive es el fallback. Nunca bloquea ni rompe la navegación.
function pingContact(propertyId?: string | null) {
  if (!import.meta.client) return
  const params = new URLSearchParams()
  if (propertyId) params.set('p', propertyId)
  // El mismo id que mandó la apertura: así el contacto es de una persona
  // que abrió, y no de un visitante suelto.
  const vid = linkVisitorId()
  if (vid) params.set('v', vid)
  const url = `/api/l/${code}/click?${params}`
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

// Una sola vez por sesión: volver atrás desde una ficha no es otra
// apertura. Lo decide linkVisitor.ts, no esta página.
onMounted(() => {
  if (!error.value) pingLinkOpen(code, data.value?.property?.id ?? null)
})

const rentals = computed(() => data.value?.catalog?.rentals ?? [])
const sales = computed(() => data.value?.catalog?.sales ?? [])
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
        :contact-message="contactMessage"
        hide-brand-badge
        @click="onContact"
      />
      <SaleDetailBody
        v-else-if="data.propertyKind === 'sale'"
        :sale="data.property"
        :whatsapp-phone="seller?.whatsapp"
        :contact-label="contactLabel"
        :contact-message="contactMessage"
        hide-brand-badge
        @click="onContact"
      />
    </template>

    <!-- Mismos filtros y misma vista de mapa que el catálogo público: el
         vendedor comparte una lista que puede tener 80 propiedades, y sin
         filtros el cliente tiene que scrollearlas todas. Ver
         components/SellerCatalog.vue. -->
    <SellerCatalog v-else :rentals="rentals" :sales="sales" :code="code" />

    <!-- El cierre de la página: el cliente terminó de mirar y acá tiene todos
         los datos del vendedor juntos, no sólo el botón de la barra de
         arriba. Va después tanto de una ficha como del grid del catálogo. -->
    <SellerContactCard
      :seller="seller"
      :contact-href="contactHref"
      :contact-label="contactLabel"
      @click="onContact"
    />
  </template>
</template>
