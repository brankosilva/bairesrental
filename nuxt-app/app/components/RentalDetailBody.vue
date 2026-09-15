<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RentalProperty } from '~/types/property'

// Cuerpo de la ficha de un alquiler. Extraído tal cual de
// app/pages/departamentos/[id].vue, que hasta acá era el único lugar donde
// existía este diseño.
//
// Se extrajo porque ahora hay DOS páginas que lo muestran: la ficha pública
// y la página con la marca del vendedor (/l/:code). Lo que cambia entre una
// y otra es chico y entra todo en props — a dónde vuelve el botón "volver",
// qué número atiende el WhatsApp y cómo se llama ese botón — así que
// duplicar el markup y las ~390 líneas de CSS habría sido mantener dos
// copias del mismo diseño para eso.
//
// La página sigue siendo dueña de lo suyo: fetch, SEO/OG, JSON-LD y el caso
// "no encontrado". Acá adentro no hay nada de eso a propósito; este
// componente no sabe de dónde salió la propiedad.
const props = withDefaults(
  defineProps<{
    rental: RentalProperty
    /** A dónde vuelve el botón "volver". Vacío = no se muestra (página compartida de una sola propiedad). */
    backTo?: string
    backLabel?: string
    /** Esconde el botón de contacto — lo usa el modo vendedor (?vendor=1). */
    hideWhatsapp?: boolean
    /** Número que atiende el WhatsApp. Sin esto va el de BairesRental (ver utils/format.ts). */
    whatsappPhone?: string | null
    /** Texto del botón de contacto. Ej: "Contactar a Juan". */
    contactLabel?: string
    /**
     * Mensaje de WhatsApp ya armado. Lo pasa la página con la marca del
     * vendedor, que lo arma con el nombre del destinatario, así el botón del
     * cuerpo manda lo mismo que el de la cabecera.
     */
    contactMessage?: string
    /**
     * Esconde el badge "★ BairesRental" de las propiedades propias.
     * Lo usa la página con la marca del vendedor: ahí la marca de
     * BairesRental no va en ningún lado, y este badge es el único pedazo
     * del cuerpo de la ficha que la nombra.
     */
    hideBrandBadge?: boolean
  }>(),
  { backTo: '', backLabel: '', hideWhatsapp: false, whatsappPhone: null, contactLabel: '', contactMessage: '', hideBrandBadge: false },
)

const { t, locale } = useI18n()

const heroImgError = ref(false)

const disponibilidadClass = computed(() => {
  if (props.rental.disponibilidad === 'disponible') return 'disponible'
  if (props.rental.disponibilidad === 'reservado') return 'reservado'
  return 'no-disponible'
})

const disponibleDesdeLabel = computed(() =>
  props.rental.disponibleDesde ? formatLongDate(props.rental.disponibleDesde, locale.value) : '',
)

const mapSrc = computed(() => mapEmbedSrc(props.rental.direccion, props.rental.direccionUrl))

// Prioriza el álbum de fotos; si no hay, cae a una ficha externa (Airbnb/Booking).
const fotosLink = computed(() => props.rental.fotos || props.rental.fichaUrl || '')
const fotosLabel = computed(() => (props.rental.fotos ? t('detail.seeAllPhotos') : t('detail.viewFullListing')))

// EL `whatsappMsg` GUARDADO NO SE USA EN LA PÁGINA DEL VENDEDOR. Es texto
// cargado para el sitio público y hay propiedades donde nombra a la empresa
// ("...que vi en la web de BairesRental"), o sea que el cliente le mandaría al
// vendedor un mensaje citando a BairesRental desde una página que justamente
// no la nombra en ningún lado. `hideBrandBadge` ya es la señal de white-label
// para el badge y para el título de la hoja de compartir; acá hace lo mismo.
const waHref = computed(() => {
  const guardado = props.hideBrandBadge ? '' : props.rental.whatsappMsg
  return whatsappUrl(
    props.contactMessage ||
      guardado ||
      `Hola! Me interesa el departamento "${props.rental.titulo}" en ${props.rental.barrio}. ¿Podés darme más información?`,
    props.whatsappPhone,
  )
})

const { copied: shareCopied, share } = useShare()
function onShare() {
  // En la página con la marca del vendedor el título de la hoja de
  // "compartir" no puede decir BairesRental: es el mismo motivo por el que
  // se esconde el badge. hideBrandBadge hace de señal de "esto es
  // white-label" para las dos cosas.
  share(props.hideBrandBadge ? props.rental.titulo : `${props.rental.titulo} — BairesRental`)
}
</script>

<template>
    <main class="br-detail">
      <div id="depto-hero" :class="{ 'depto-hero--noimg': !rental.imagen || heroImgError }">
        <img
          v-if="rental.imagen && !heroImgError"
          id="depto-hero-img"
          :src="rental.imagen"
          :alt="rental.titulo"
          @error="heroImgError = true"
        />
        <div id="depto-hero-gradient"></div>
        <div id="depto-hero-top">
          <NuxtLink v-if="backTo" :to="backTo" class="depto-back-btn">{{ backLabel || t('detail.backToRentals') }}</NuxtLink>
          <span v-else></span>
          <div class="depto-hero-badges">
            <span class="badge-disp" :class="disponibilidadClass">● {{ t(`disponibilidad.${rental.disponibilidad}`) }}</span>
            <span v-if="rental.esPropio && !hideBrandBadge" class="badge-baires">★ BairesRental</span>
          </div>
        </div>
        <a v-if="fotosLink" :href="fotosLink" target="_blank" rel="noopener" class="depto-hero-fotos-btn">📷 {{ fotosLabel }}</a>
      </div>

      <div class="depto-container">
        <div class="depto-location">{{ [rental.barrio, rental.tipo].filter(Boolean).join(' · ').toUpperCase() }}</div>
        <h1 id="depto-titulo">{{ rental.titulo }}</h1>

        <div class="depto-precio-row">
          <template v-if="rental.precio">
            <span class="depto-precio">{{ rental.moneda || 'USD' }} {{ Number(rental.precio).toLocaleString('es-AR') }}</span>
            <span class="depto-moneda">{{ t('departamentos.perMonth') }}</span>
          </template>
          <span v-else class="depto-consultar">{{ t('departamentos.card.consultarPrecio') }}</span>
        </div>
        <p v-if="rental.precio" class="depto-precio-sub">
          {{ rental.serviciosIncluidos ? t('detail.servicesIncluded') : t('detail.servicesNotIncluded') }}
        </p>

        <p v-if="disponibleDesdeLabel" class="depto-desde">📅 {{ t('detail.availableFrom', { date: disponibleDesdeLabel }) }}</p>

        <p class="depto-desc">{{ rental.descripcion }}</p>

        <template v-if="rental.amenities?.length">
          <div class="depto-section-title">{{ t('detail.amenitiesTitle') }}</div>
          <div class="depto-amenities-grid">
            <span v-for="a in rental.amenities" :key="a" class="depto-amenity-chip">{{ amenityLabel(a) }}</span>
          </div>
        </template>

        <div class="depto-section-title">{{ t('detail.featuresTitle') }}</div>
        <div class="depto-carac-grid">
          <div class="depto-carac-item">
            <span class="depto-carac-label">{{ t('detail.furnished') }}</span>
            <span class="depto-carac-value">{{ rental.amueblado ? '✓ ' + t('detail.yes') : '✗ ' + t('detail.no') }}</span>
          </div>
          <div class="depto-carac-item">
            <span class="depto-carac-label">{{ t('detail.petsAllowed') }}</span>
            <span class="depto-carac-value">{{ rental.mascotas ? '✓ ' + t('detail.yes') : '✗ ' + t('detail.no') }}</span>
          </div>
          <div class="depto-carac-item">
            <span class="depto-carac-label">{{ t('detail.servicesIncludedLabel') }}</span>
            <span class="depto-carac-value">{{ rental.serviciosIncluidos ? '✓ ' + t('detail.yes') : '✗ ' + t('detail.no') }}</span>
          </div>
          <div class="depto-carac-item">
            <span class="depto-carac-label">{{ t('detail.minStay') }}</span>
            <span class="depto-carac-value">{{ rental.minimoMeses }} {{ rental.minimoMeses === 1 ? t('detail.month') : t('detail.months') }}</span>
          </div>
        </div>

        <template v-if="rental.direccion">
          <div class="depto-section-title">{{ t('detail.locationTitle') }}</div>
          <div class="depto-direccion-wrap">
            <a :href="rental.direccionUrl || undefined" target="_blank" rel="noopener" class="depto-direccion">
              📍 {{ rental.direccion }}
            </a>
          </div>
          <div v-if="mapSrc" class="depto-mapa-wrap">
            <iframe :src="mapSrc" class="depto-mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación"></iframe>
          </div>
        </template>

        <div class="depto-actions">
          <a v-if="fotosLink" :href="fotosLink" target="_blank" rel="noopener" class="btn-primary-depto">{{ fotosLabel }}</a>
          <div class="depto-actions-row">
            <a v-if="!hideWhatsapp" :href="waHref" target="_blank" rel="noopener" class="btn-secondary-depto btn-wa-secondary">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path
                  d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
                />
              </svg>
              {{ contactLabel || t('detail.whatsapp') }}
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
        </div>

        <NuxtLink v-if="backTo" :to="backTo" class="depto-back-bottom">{{ backLabel || t('detail.backToRentals') }}</NuxtLink>
      </div>
    </main>
</template>

<style scoped>
/* Ported verbatim from departamento.html's inline <style> (hero, content,
   amenities/características/dirección/acciones sections) — nav/mobile-drawer/
   footer styles are skipped here since layouts/default.vue already provides
   that chrome for every page.

   Los tokens (--azul, --negro, ...) se definían acá con `:root { ... }`,
   pero dentro de un `<style scoped>` Vue lo compila a
   `[data-v-hash]:root` y <html> nunca matchea, así que las 16 referencias
   var() de este archivo resolvían a nada — incluido
   `.btn-primary-depto { background: var(--azul); color: #fff }`, que
   quedaba como un botón invisible (fondo transparente, texto blanco).
   Ahora vienen de public/css/br-base.css, que es un :root real y global. */
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
#depto-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
#depto-hero-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72) 0%, transparent 100%);
  pointer-events: none;
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
.badge-disp.no-disponible {
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
.depto-moneda {
  font-size: 14px;
  font-weight: 600;
  color: var(--texto-gris);
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
.depto-desde {
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
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
.btn-primary-depto {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--azul);
  color: #fff !important;
  text-decoration: none !important;
  font-size: 15px;
  font-weight: 700;
  padding: 16px;
  border-radius: 100px;
  transition: background 0.2s, transform 0.15s;
}
.btn-primary-depto:hover {
  background: var(--azul-dark);
  transform: translateY(-2px);
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
    bottom: 14px;
    right: 16px;
    font-size: 12.5px;
    padding: 9px 14px;
  }
}
</style>
