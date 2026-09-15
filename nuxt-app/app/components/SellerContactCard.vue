<script setup lang="ts">
import { computed } from 'vue'
import type { SellerProfile } from '~/types/link'

// La ficha del vendedor al PIE de la página compartida.
//
// La barra de arriba (SellerBrandHeader) es deliberadamente compacta: está
// sticky y tiene que dejar ver la propiedad. Esto es lo contrario — se lee
// cuando el cliente terminó de mirar y es el momento en que decide escribir,
// así que acá van todos los datos del vendedor y no un subconjunto: foto,
// nombre, cómo se presenta, su línea de presentación, el número a la vista
// (no sólo detrás de un botón: mucha gente prefiere agendarlo) y su
// Instagram.
//
// Reemplaza al pie de BairesRental, que esta página no lleva a propósito
// (ver el encabezado de public/css/br-brand.css).
const props = defineProps<{
  seller: SellerProfile | null
  contactHref: string
  contactLabel: string
}>()

const initials = computed(() =>
  (props.seller?.displayName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)

// El número visible sale de la MISMA normalización que arma el wa.me, así
// que lo que se muestra y a dónde va el botón no pueden divergir.
const phoneDisplay = computed(() => formatWhatsappDisplay(props.seller?.whatsapp))
const phoneHref = computed(() => (props.seller?.whatsapp ? `tel:+${normalizeWhatsapp(props.seller.whatsapp)}` : null))

const instagram = computed(() => instagramHandle(props.seller?.instagram))

const accent = computed(() => props.seller?.accentColor || null)
</script>

<template>
  <section v-if="seller" class="br-seller-card" :style="accent ? { '--br-brand-accent': accent } : undefined">
    <div class="br-seller-card-head">
      <div class="br-seller-card-avatar">
        <img v-if="seller.photoUrl" :src="seller.photoUrl" :alt="seller.displayName || ''" loading="lazy" />
        <span v-else>{{ initials || '·' }}</span>
      </div>
      <div class="br-seller-card-ident">
        <strong>{{ seller.displayName }}</strong>
        <span v-if="seller.title" class="br-seller-card-title">{{ seller.title }}</span>
      </div>
    </div>

    <p v-if="seller.bio" class="br-seller-card-bio">{{ seller.bio }}</p>

    <a :href="contactHref" target="_blank" rel="noopener" class="br-seller-card-cta" data-br-contact>
      <i class="bi bi-whatsapp" aria-hidden="true"></i>
      {{ contactLabel }}
    </a>

    <!-- `.stop` en todo lo que NO es el botón de contacto: la página engancha
         el click a nivel raíz de este componente para contar la conversión
         (ver pingContact en pages/l/[code]/index.vue), así que sin esto tocar
         el Instagram sumaría un "contacto por WhatsApp" que nunca pasó. -->
    <ul class="br-seller-card-data">
      <li v-if="phoneDisplay">
        <i class="bi bi-telephone" aria-hidden="true"></i>
        <a v-if="phoneHref" :href="phoneHref" @click.stop>{{ phoneDisplay }}</a>
        <span v-else>{{ phoneDisplay }}</span>
      </li>
      <li v-if="instagram">
        <i class="bi bi-instagram" aria-hidden="true"></i>
        <a :href="`https://instagram.com/${instagram}`" target="_blank" rel="noopener" @click.stop>@{{ instagram }}</a>
      </li>
    </ul>
  </section>
</template>
