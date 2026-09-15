<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

const heroCoverError = ref(false)

const disponibilidadClass = computed(() => {
  if (sale.value?.disponibilidad === 'disponible') return 'disponible'
  if (sale.value?.disponibilidad === 'reservado') return 'reservado'
  return 'vendido'
})

// Hero collage: cover photo + up to 4 thumbnails, ported from
// detalle-venta.html's render() — desktop shows a "+N" overlay on the 4th
// thumb, mobile (CSS-only, see <style>) hides the 4th thumb and shows its
// own "+N" on the 3rd instead.
const thumbs = computed(() => sale.value?.fotos?.slice(1, 5) ?? [])
const remainderDesktop = computed(() => (sale.value?.fotos?.length ?? 0) - 1 - 4)
const remainderMobile = computed(() => (sale.value?.fotos?.length ?? 0) - 1 - 3)
const thumbCols = computed(() => (thumbs.value.length <= 1 ? 1 : 2))
const thumbRows = computed(() => Math.ceil(thumbs.value.length / thumbCols.value))
function isOddLastThumb(i: number) {
  return thumbs.value.length > 1 && thumbs.value.length % 2 === 1 && i === thumbs.value.length - 1
}

const mapSrc = computed(() => mapEmbedSrc(sale.value?.direccion, sale.value?.direccionUrl))

const waHref = computed(() =>
  whatsappUrl(
    sale.value?.whatsappMsg ||
      `Hola! Me interesa la propiedad "${sale.value?.titulo}" en ${sale.value?.barrio}. ¿Podés darme más información?`,
  ),
)

const { copied: shareCopied, share } = useShare()
function onShare() {
  share(sale.value ? `${sale.value.titulo} — BairesRental` : 'BairesRental')
}
</script>

<template>
  <main v-if="sale" class="br-detail">
    <div id="depto-hero" :class="{ 'depto-hero--noimg': !sale.fotos?.length }">
      <div v-if="sale.fotos?.length" class="depto-hero-collage">
        <div class="hero-cover" @click="openLightbox(0)">
          <img v-if="!heroCoverError" :src="sale.fotos[0]" :alt="sale.titulo" @error="heroCoverError = true" />
        </div>
        <div v-if="thumbs.length" class="hero-thumbs" :style="{ gridTemplateColumns: `repeat(${thumbCols}, 1fr)`, gridTemplateRows: `repeat(${thumbRows}, 1fr)` }">
          <div
            v-for="(foto, i) in thumbs"
            :key="i"
            class="hero-thumb"
            :style="isOddLastThumb(i) ? { gridColumn: 'span 2' } : undefined"
            @click="openLightbox(i + 1)"
          >
            <img :src="foto" :alt="`${sale.titulo} — foto ${i + 2}`" loading="lazy" />
            <div v-if="i === 3 && remainderDesktop > 0" class="hero-thumb-mas hero-thumb-mas-desktop">+{{ remainderDesktop }}</div>
            <div v-if="i === 2 && remainderMobile > 0" class="hero-thumb-mas hero-thumb-mas-mobile">+{{ remainderMobile }}</div>
          </div>
        </div>
      </div>
      <div id="depto-hero-top">
        <NuxtLink :to="localePath('/ventas')" class="depto-back-btn">{{ t('detail.backToSales') }}</NuxtLink>
        <div class="depto-hero-badges">
          <span class="badge-disp" :class="disponibilidadClass">● {{ t(`disponibilidad.${sale.disponibilidad}`) }}</span>
          <span v-if="sale.esPropio" class="badge-baires">★ BairesRental</span>
        </div>
      </div>
      <button v-if="sale.fotos?.length" type="button" class="depto-hero-fotos-btn" @click="openLightbox(0)">
        📷 {{ t('detail.seePhotos', { count: sale.fotos.length }) }}
      </button>
    </div>

    <div class="depto-container">
      <div class="depto-location">{{ [sale.barrio, sale.tipo].filter(Boolean).join(' · ').toUpperCase() }}</div>
      <h1 id="depto-titulo">{{ sale.titulo }}</h1>

      <div class="depto-precio-row">
        <span v-if="sale.precio" class="depto-precio">{{ sale.moneda || 'USD' }} {{ Number(sale.precio).toLocaleString('es-AR') }}</span>
        <span v-else class="depto-consultar">{{ t('departamentos.card.consultarPrecio') }}</span>
      </div>
      <p v-if="sale.precio && (sale.superficie || sale.expensas)" class="depto-precio-sub">
        {{ [sale.superficie ? `${sale.superficie} m²` : '', sale.expensas ? `${t('detail.expenses')} ARS ${sale.expensas.toLocaleString('es-AR')}` : ''].filter(Boolean).join(' · ') }}
      </p>
      <p v-if="sale.aptoCredito" class="depto-apto-credito">{{ t('detail.mortgageEligible') }}</p>

      <p class="depto-desc">{{ sale.descripcion }}</p>

      <template v-if="sale.amenities?.length">
        <div class="depto-section-title">{{ t('detail.amenitiesTitle') }}</div>
        <div class="depto-amenities-grid">
          <span v-for="a in sale.amenities" :key="a" class="depto-amenity-chip">{{ amenityLabel(a) }}</span>
        </div>
      </template>

      <div class="depto-section-title">{{ t('detail.featuresTitle') }}</div>
      <div class="depto-carac-grid">
        <div v-if="sale.ambientes" class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.rooms') }}</span>
          <span class="depto-carac-value">{{ sale.ambientes }}</span>
        </div>
        <div class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.totalArea') }}</span>
          <span class="depto-carac-value">{{ sale.superficie }} m²</span>
        </div>
        <div v-if="sale.superficieCubierta" class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.coveredArea') }}</span>
          <span class="depto-carac-value">{{ sale.superficieCubierta }} m²</span>
        </div>
        <div v-if="sale.banios" class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.bathrooms') }}</span>
          <span class="depto-carac-value">{{ sale.banios }}</span>
        </div>
        <div v-if="sale.antiguedad" class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.age') }}</span>
          <span class="depto-carac-value">{{ sale.antiguedad }}</span>
        </div>
        <div class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.furnished') }}</span>
          <span class="depto-carac-value">{{ sale.amueblado ? '✓ ' + t('detail.yes') : '✗ ' + t('detail.no') }}</span>
        </div>
        <div class="depto-carac-item">
          <span class="depto-carac-label">{{ t('detail.mortgageEligibleLabel') }}</span>
          <span class="depto-carac-value">{{ sale.aptoCredito ? '✓ ' + t('detail.yes') : '✗ ' + t('detail.no') }}</span>
        </div>
      </div>

      <template v-if="sale.direccion">
        <div class="depto-section-title">{{ t('detail.locationTitle') }}</div>
        <div class="depto-direccion-wrap">
          <a :href="sale.direccionUrl || undefined" target="_blank" rel="noopener" class="depto-direccion">
            📍 {{ sale.direccion }}
          </a>
        </div>
        <div v-if="mapSrc" class="depto-mapa-wrap">
          <iframe :src="mapSrc" class="depto-mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación"></iframe>
        </div>
      </template>

      <div class="depto-actions">
        <div class="depto-actions-row">
          <a :href="waHref" target="_blank" rel="noopener" class="btn-secondary-depto btn-wa-secondary" style="flex: 2">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path
                d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
              />
            </svg>
            {{ t('detail.contactWhatsapp') }}
          </a>
          <button type="button" class="btn-secondary-depto" @click="onShare">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path
                d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
              />
            </svg>
            {{ shareCopied ? t('detail.linkCopied') : t('detail.share') }}
          </button>
        </div>
        <a v-if="sale.fichaUrl" :href="sale.fichaUrl" target="_blank" rel="noopener" class="btn-secondary-depto">{{ t('detail.viewFullListing') }}</a>
      </div>

      <NuxtLink :to="localePath('/ventas')" class="depto-back-bottom">{{ t('detail.backToSales') }}</NuxtLink>
    </div>

    <div
      v-if="lightboxIndex !== null"
      class="br-lightbox"
      @click.self="closeLightbox"
    >
      <button class="lightbox-close" aria-label="Cerrar" @click="closeLightbox">✕</button>
      <button class="lightbox-prev" aria-label="Anterior" @click="prev">‹</button>
      <img :src="sale.fotos[lightboxIndex]" :alt="`${sale.titulo} ${lightboxIndex + 1}`" />
      <button class="lightbox-next" aria-label="Siguiente" @click="next">›</button>
      <span class="lightbox-counter">{{ lightboxIndex + 1 }} / {{ sale.fotos.length }}</span>
    </div>
  </main>

  <main v-else class="container py-5 text-center">
    <h1 class="h4">{{ t('detail.notFoundTitle') }}</h1>
    <p><NuxtLink :to="localePath('/ventas')">{{ t('detail.backToSales') }}</NuxtLink></p>
  </main>
</template>

<style scoped>
/* Ported verbatim from detalle-venta.html's inline <style> — same scope
   notes as departamentos/[id].vue (nav/drawer/footer skipped, already in
   layouts/default.vue). Hero uses a photo collage instead of a single
   image + lightbox instead of an external photo-album link, matching how
   the static site differentiates sales from rentals.

   Los tokens (--azul, --negro, ...) se definían acá con `:root { ... }`,
   pero dentro de un `<style scoped>` Vue lo compila a
   `[data-v-hash]:root` y <html> nunca matchea, así que las 13 referencias
   var() de este archivo resolvían a nada. Ahora vienen de
   public/css/br-base.css, que es un :root real y global. */
.br-detail {
  font-family: 'DM Sans', sans-serif;
}

/* ── HERO IMAGE ──────────────────────────────────────── */
#depto-hero {
  position: relative;
  height: 58vh;
  min-height: 320px;
  background: #111;
  overflow: hidden;
}
#depto-hero.depto-hero--noimg {
  background: #1a1a2e;
}
@media (max-width: 600px) {
  #depto-hero {
    height: 62vh;
    min-height: 380px;
  }
}
.depto-hero-collage {
  display: flex;
  gap: 4px;
  width: 100%;
  height: 100%;
}
.hero-cover {
  flex: 1;
  height: 100%;
  overflow: hidden;
  cursor: pointer;
  background: #1a1a1a;
}
.hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s;
}
.hero-cover:hover img {
  transform: scale(1.04);
}
.hero-thumbs {
  flex: 1;
  display: grid;
  gap: 4px;
  height: 100%;
  min-width: 0;
}
.hero-thumb {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: #1a1a1a;
}
.hero-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s;
}
.hero-thumb:hover img {
  transform: scale(1.06);
}
.hero-thumb-mas {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}
.hero-thumb-mas-mobile {
  display: none;
}
@media (max-width: 600px) {
  .depto-hero-collage {
    flex-direction: column;
  }
  .hero-cover {
    flex: 1;
  }
  .hero-thumbs {
    flex: none;
    height: 80px;
    grid-template-columns: repeat(3, 1fr) !important;
    grid-template-rows: 1fr !important;
  }
  .hero-thumb {
    grid-column: unset !important;
  }
  .hero-thumb:nth-child(4) {
    display: none;
  }
  .hero-thumb-mas {
    font-size: 14px;
  }
  .hero-thumb-mas-desktop {
    display: none;
  }
  .hero-thumb-mas-mobile {
    display: flex;
  }
}
#depto-hero-top {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.depto-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85) !important;
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 100px;
  transition: background 0.2s, color 0.2s;
}
.depto-back-btn:hover {
  background: rgba(0, 0, 0, 0.65);
  color: #fff !important;
}
.depto-hero-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.depto-hero-fotos-btn {
  position: absolute;
  bottom: 20px;
  right: 24px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  color: #111 !important;
  text-decoration: none !important;
  font-size: 13.5px;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 100px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
  border: none;
  cursor: pointer;
}
.depto-hero-fotos-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.badge-disp {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 100px;
  letter-spacing: 0.04em;
}
.badge-disp.disponible {
  background: rgba(34, 197, 94, 0.85);
  color: #fff;
}
.badge-disp.reservado {
  background: rgba(245, 158, 11, 0.85);
  color: #fff;
}
.badge-disp.vendido {
  background: rgba(239, 68, 68, 0.85);
  color: #fff;
}
.badge-baires {
  background: rgba(26, 111, 232, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 100px;
}

/* ── CONTENT ─────────────────────────────────────────── */
.depto-container {
  max-width: 820px;
  margin: 0 auto;
  padding: 36px 24px 64px;
}
.depto-location {
  font-size: 13px;
  font-weight: 600;
  color: var(--texto-gris);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}
#depto-titulo {
  font-size: clamp(26px, 4vw, 38px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #111;
  margin-bottom: 16px;
}
.depto-precio-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}
.depto-precio {
  font-size: 28px;
  font-weight: 800;
  color: var(--azul);
}
.depto-consultar {
  font-size: 18px;
  font-weight: 600;
  color: var(--texto-gris);
}
.depto-precio-sub {
  font-size: 12px;
  color: var(--texto-gris);
  margin-bottom: 16px;
}
.depto-apto-credito {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0f9ff;
  color: #0369a1;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 100px;
  margin-bottom: 16px;
}
.depto-desc {
  font-size: 15px;
  line-height: 1.7;
  color: #374151;
  margin-bottom: 32px;
  white-space: pre-line;
}

/* ── SECTION TITLES ─────────────────────────────────── */
.depto-section-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--texto-gris);
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 10px;
  margin-bottom: 20px;
  margin-top: 32px;
}

/* ── LIGHTBOX ───────────────────────────────────────── */
.br-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
}
.br-lightbox img {
  max-width: 92vw;
  max-height: 82vh;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
}
.lightbox-close,
.lightbox-prev,
.lightbox-next {
  position: absolute;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.lightbox-close:hover,
.lightbox-prev:hover,
.lightbox-next:hover {
  background: rgba(255, 255, 255, 0.24);
}
.lightbox-close {
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  font-size: 20px;
}
.lightbox-prev,
.lightbox-next {
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 52px;
  font-size: 22px;
}
.lightbox-prev {
  left: 16px;
}
.lightbox-next {
  right: 16px;
}
.lightbox-counter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 14px;
  border-radius: 100px;
}
@media (max-width: 600px) {
  .lightbox-prev,
  .lightbox-next {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }
  .lightbox-close {
    width: 36px;
    height: 36px;
    font-size: 16px;
    top: 12px;
    right: 12px;
  }
}

/* ── AMENITIES ──────────────────────────────────────── */
.depto-amenities-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.depto-amenity-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gris);
  border: 1px solid #e5e7eb;
  padding: 7px 14px;
  border-radius: 100px;
  font-size: 13px;
  color: #374151;
}

/* ── CARACTERISTICAS ────────────────────────────────── */
.depto-carac-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.depto-carac-item {
  background: var(--gris);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.depto-carac-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--texto-gris);
}
.depto-carac-value {
  font-size: 14px;
  font-weight: 700;
  color: #111;
}

/* ── DIRECCION ──────────────────────────────────────── */
.depto-direccion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--gris);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 18px;
  font-size: 14px;
  color: #374151;
  text-decoration: none !important;
  transition: background 0.2s;
}
.depto-direccion:hover {
  background: #e9e9ef;
}
.depto-direccion-wrap {
  margin-top: 16px;
}
.depto-mapa-wrap {
  margin-top: 14px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  line-height: 0;
}
.depto-mapa {
  width: 100%;
  height: 260px;
  border: 0;
  display: block;
}
@media (max-width: 600px) {
  .depto-mapa {
    height: 200px;
  }
}

/* ── ACTION BUTTONS ─────────────────────────────────── */
.depto-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 36px;
}
.depto-actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.btn-secondary-depto {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--gris);
  border: 1px solid #e5e7eb;
  color: #374151 !important;
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 20px;
  border-radius: 100px;
  transition: background 0.2s;
  cursor: pointer;
}
.btn-secondary-depto:hover {
  background: #e9e9ef;
}
.btn-wa-secondary svg {
  color: var(--verde);
}

/* ── BACK BOTTOM ────────────────────────────────────── */
.depto-back-bottom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--texto-gris) !important;
  text-decoration: none !important;
  font-size: 13px;
  font-weight: 600;
  margin-top: 40px;
  transition: color 0.2s;
}
.depto-back-bottom:hover {
  color: var(--azul) !important;
}

@media (max-width: 600px) {
  .depto-container {
    padding: 24px 16px 48px;
  }
  #depto-titulo {
    font-size: 24px;
  }
  .depto-carac-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .depto-actions-row {
    flex-direction: column;
  }
  .btn-secondary-depto {
    min-width: 0;
  }
  .depto-hero-fotos-btn {
    bottom: 98px;
    right: 16px;
    font-size: 12.5px;
    padding: 9px 14px;
  }
}
</style>
