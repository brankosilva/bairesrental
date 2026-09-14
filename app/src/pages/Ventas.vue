<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRouter } from 'vue-router'
import { getAllSales } from '../data/properties'
import type { SaleProperty } from '../data/properties'
import { whatsappUrl, truncate } from '../utils/format'
import SiteLayout from '../layouts/SiteLayout.vue'
import { routeName } from '../router'
import { useLocaleLinks } from '../i18n/useLocaleLinks'

const { t } = useI18n()
const router = useRouter()
const { currentLocale, hreflangLinks } = useLocaleLinks()

useHead({
  title: currentLocale === 'en' ? 'Apartments for sale in Buenos Aires — BairesRental' : 'Departamentos en venta en Buenos Aires — BairesRental',
  meta: [
    {
      name: 'description',
      content:
        currentLocale === 'en'
          ? 'Verified properties for sale in Buenos Aires, with all the information and photos you need to decide.'
          : 'Propiedades verificadas en venta en Buenos Aires, con toda la información y fotos que necesitás para decidir.',
    },
  ],
  link: [
    { rel: 'canonical', href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/ventas` },
    ...hreflangLinks,
  ],
})

const allSales = await getAllSales()
// "vendido" listings are kept in the data for internal use but never shown publicly.
const visibleSales = computed(() => allSales.filter((s) => s.disponibilidad !== 'vendido'))

const AMENITY_META: Record<string, { icon: string; key: string }> = {
  pileta: { icon: '🏊', key: 'pileta' },
  gimnasio: { icon: '🏋️', key: 'gimnasio' },
  laundry: { icon: '🫧', key: 'laundry' },
  parrilla: { icon: '🔥', key: 'parrilla' },
  terraza: { icon: '🌿', key: 'terraza' },
  cochera: { icon: '🚗', key: 'cochera' },
  sauna: { icon: '♨️', key: 'sauna' },
  solárium: { icon: '☀️', key: 'solarium' },
  'seguridad 24hs': { icon: '🔒', key: 'seguridad24hs' },
  jacuzzi: { icon: '🛁', key: 'jacuzzi' },
  lavarropas: { icon: '🧺', key: 'lavarropas' },
}
const AMENITY_FILTERS = ['pileta', 'gimnasio', 'laundry', 'parrilla', 'terraza', 'cochera', 'sauna', 'solárium', 'seguridad 24hs', 'jacuzzi']
const TIPOS = [
  { value: 'monoambiente', labelKey: 'tipoMono' },
  { value: '2 ambientes', labelKey: 'tipo2' },
  { value: '3 ambientes', labelKey: 'tipo3' },
  { value: '4+ ambientes', labelKey: 'tipo4' },
  { value: 'casa', labelKey: 'tipoCasa' },
  { value: 'PH', labelKey: 'tipoPh' },
] as const

function amenityLabel(a: string) {
  const meta = AMENITY_META[a]
  return meta ? t(`ventas.amenities.${meta.key}`) : `✦ ${a}`
}

function normalizarBarrio(b: string) {
  return b
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
const barrios = computed(() => [...new Set(visibleSales.value.map((s) => normalizarBarrio(s.barrio)))].sort())

const PRECIO_MIN = 30000
const PRECIO_MAX = 500000
const PRECIO_STEP = 5000
const SUPERFICIE_MIN = 0
const SUPERFICIE_MAX = 300
const SUPERFICIE_STEP = 5

const search = ref('')
const barrio = ref('')
const tipos = ref<string[]>([])
const precioMax = ref(PRECIO_MAX)
const superficieMin = ref(SUPERFICIE_MIN)
const aptoCredito = ref(false)
const soloBairesRental = ref(false)
const soloDisponibles = ref(false)
const amenitiesSel = ref<string[]>([])

function toggleTipo(tp: string) {
  const idx = tipos.value.indexOf(tp)
  if (idx === -1) tipos.value.push(tp)
  else tipos.value.splice(idx, 1)
}
function toggleAmenity(a: string) {
  const idx = amenitiesSel.value.indexOf(a)
  if (idx === -1) amenitiesSel.value.push(a)
  else amenitiesSel.value.splice(idx, 1)
}
function clearFilters() {
  search.value = ''
  barrio.value = ''
  tipos.value = []
  precioMax.value = PRECIO_MAX
  superficieMin.value = SUPERFICIE_MIN
  aptoCredito.value = false
  soloBairesRental.value = false
  soloDisponibles.value = false
  amenitiesSel.value = []
}

const filtered = computed(() =>
  visibleSales.value
    .filter((s) => {
      if (barrio.value && normalizarBarrio(s.barrio) !== barrio.value) return false
      if (tipos.value.length && !tipos.value.includes(s.tipo)) return false
      if (s.precio > 0 && (s.moneda === 'USD' || !s.moneda) && s.precio > precioMax.value) return false
      if (superficieMin.value > 0 && !(s.superficie > 0 && s.superficie >= superficieMin.value)) return false
      if (search.value.trim()) {
        const q = search.value.trim().toLowerCase()
        const hit = [s.titulo, s.barrio, s.tipo, s.descripcion, s.direccion].some((c) => c && c.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (aptoCredito.value && !s.aptoCredito) return false
      if (soloBairesRental.value && !s.esPropio) return false
      if (soloDisponibles.value && s.disponibilidad !== 'disponible') return false
      if (amenitiesSel.value.length && !amenitiesSel.value.every((a) => s.amenities.includes(a))) return false
      return true
    })
    .sort((a, b) => {
      if (a.esPropio && !b.esPropio) return -1
      if (!a.esPropio && b.esPropio) return 1
      const order: Record<string, number> = { disponible: 0, reservado: 1, vendido: 2 }
      return (order[a.disponibilidad] ?? 0) - (order[b.disponibilidad] ?? 0)
    }),
)

const activeFilterCount = computed(() => {
  let n = 0
  if (barrio.value) n++
  if (tipos.value.length) n++
  if (precioMax.value < PRECIO_MAX) n++
  if (superficieMin.value > 0) n++
  if (amenitiesSel.value.length) n++
  if (aptoCredito.value) n++
  if (soloBairesRental.value) n++
  if (soloDisponibles.value) n++
  if (search.value.trim()) n++
  return n
})

// ── Mobile filter sheet ──────────────────────────────
const sheetOpen = ref(false)
watch(sheetOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
function onResize() {
  if (window.innerWidth > 768) sheetOpen.value = false
}
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.body.style.overflow = ''
})

// ── Card actions ──────────────────────────────────────
function goTo(s: SaleProperty) {
  router.push({ name: routeName('venta-detail', currentLocale), params: { id: s.id } })
}
function detailHref(s: SaleProperty) {
  return router.resolve({ name: routeName('venta-detail', currentLocale), params: { id: s.id } }).href
}
const SITE_URL = 'https://www.bairesrental.com.ar'
function waMessageFor(s: SaleProperty) {
  const base = s.whatsappMsg || `Hola! Me interesa ${s.titulo}`
  const ficha = s.fichaUrl
  const link = `${SITE_URL}${detailHref(s)}`
  return `${ficha ? `${base}\n\nFicha: ${ficha}` : base}\n\nLink BairesRental: ${link}\n\nCod: ${s.id}`
}

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}
async function share(s: SaleProperty) {
  const url = `${window.location.origin}${detailHref(s)}`
  if (navigator.share) {
    try {
      await navigator.share({ title: `${s.titulo} — BairesRental`, url })
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  } else {
    await navigator.clipboard.writeText(url)
    showToast(currentLocale === 'en' ? 'Link copied ✓' : 'Link copiado al portapapeles ✓')
  }
}
</script>

<template>
  <SiteLayout>
    <section class="br-dept-hero-lite">
      <div class="br-dept-hero-lite-content">
        <span class="br-dept-eyebrow">{{ t('ventas.eyebrow') }}</span>
        <h1 class="br-dept-title-lite">{{ t('ventas.title') }}</h1>
        <p class="br-dept-sub-lite">{{ t('ventas.subtitle') }}</p>
      </div>
    </section>

    <div class="br-filtro-mob-overlay" :class="{ open: sheetOpen }" @click="sheetOpen = false"></div>

    <div class="br-filtros-wrapper" :class="{ 'mob-open': sheetOpen }">
      <div class="br-filtro-mob-bar">
        <button class="br-filtros-trigger-mob" type="button" @click="sheetOpen = true">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="10" y2="18" />
          </svg>
          {{ t('ventas.filtros.filtrar') }}
          <span class="br-filtro-badge" v-show="activeFilterCount > 0">{{ activeFilterCount }}</span>
        </button>
        <span class="br-filtro-mob-count">{{ t('ventas.filtros.propsCorto', { count: filtered.length, total: visibleSales.length }) }}</span>
      </div>

      <div class="br-filtro-sheet-header">
        <button class="br-filtro-sheet-close-btn" type="button" :aria-label="t('ventas.filtros.filtros')" @click="sheetOpen = false">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="br-filtro-sheet-title">{{ t('ventas.filtros.filtros') }}</span>
        <button class="br-filtro-sheet-reset-btn" type="button" @click="clearFilters">{{ t('ventas.filtros.limpiar') }}</button>
      </div>

      <div class="br-filtros-inner">
        <div class="br-filtros-collapsible">
          <div class="br-filtros-row">
            <div class="br-filtro-grupo br-busqueda-wrap">
              <span class="br-filtro-label">{{ t('ventas.filtros.busqueda') }}</span>
              <input v-model="search" type="search" class="br-filtro-search" :placeholder="t('ventas.filtros.busquedaPlaceholder')" autocomplete="off" />
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.barrio') }}</span>
              <select v-model="barrio" class="br-filtro-select">
                <option value="">{{ t('ventas.filtros.todos') }}</option>
                <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.tipo') }}</span>
              <div class="br-filtro-pills">
                <button
                  v-for="tp in TIPOS"
                  :key="tp.value"
                  type="button"
                  class="br-pill-btn"
                  :class="{ active: tipos.includes(tp.value) }"
                  @click="toggleTipo(tp.value)"
                >
                  {{ t(`ventas.filtros.${tp.labelKey}`) }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo br-precio-wrap">
              <div class="br-precio-top">
                <span class="br-filtro-label">{{ t('ventas.filtros.precio') }}</span>
                <span id="label-precio">USD {{ precioMax.toLocaleString('es-AR') }}</span>
              </div>
              <input v-model.number="precioMax" type="range" class="br-range" :min="PRECIO_MIN" :max="PRECIO_MAX" :step="PRECIO_STEP" />
            </div>

            <div class="br-filtro-grupo br-precio-wrap">
              <div class="br-precio-top">
                <span class="br-filtro-label">{{ t('ventas.filtros.superficie') }}</span>
                <span id="label-superficie">{{ superficieMin > 0 ? `${superficieMin} m²` : t('ventas.filtros.superficieCualquiera') }}</span>
              </div>
              <input v-model.number="superficieMin" type="range" class="br-range" :min="SUPERFICIE_MIN" :max="SUPERFICIE_MAX" :step="SUPERFICIE_STEP" />
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.financiacion') }}</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-baires" :class="{ active: aptoCredito }" @click="aptoCredito = !aptoCredito">
                  {{ t('ventas.filtros.aptoCredito') }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">BairesRental</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-baires" :class="{ active: soloBairesRental }" @click="soloBairesRental = !soloBairesRental">
                  {{ t('ventas.filtros.baires') }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.disponibilidad') }}</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-disponible" :class="{ active: soloDisponibles }" @click="soloDisponibles = !soloDisponibles">
                  {{ t('ventas.filtros.disponible') }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <div class="br-filtro-pills">
                <label v-for="a in AMENITY_FILTERS" :key="a" class="br-amenity-check">
                  <input type="checkbox" :checked="amenitiesSel.includes(a)" @change="toggleAmenity(a)" />
                  <span>{{ amenityLabel(a) }}</span>
                </label>
              </div>
            </div>

            <span class="br-contador-inline">{{ t('ventas.filtros.propsCorto', { count: filtered.length, total: visibleSales.length }) }}</span>
            <button type="button" class="br-btn-limpiar" @click="clearFilters">{{ t('ventas.filtros.limpiar') }}</button>
          </div>
        </div>
      </div>

      <div class="br-filtro-sheet-footer">
        <button type="button" class="br-filtro-sheet-apply-btn" @click="sheetOpen = false">
          {{ t('ventas.filtros.verResultadosCount', { count: filtered.length }) }}
        </button>
      </div>
    </div>

    <div class="br-catalogo-section">
      <div v-if="!filtered.length" class="text-center py-5">
        <div class="mb-3" style="font-size: 3rem">🔍</div>
        <h4 class="mb-2" style="font-family: 'DM Sans', sans-serif">{{ t('ventas.noResults.title') }}</h4>
        <p class="text-muted mb-4" style="font-family: 'DM Sans', sans-serif">{{ t('ventas.noResults.sub') }}</p>
        <a
          :href="whatsappUrl(currentLocale === 'en' ? 'Hi! I am looking for a property for sale in Buenos Aires. Could you help me?' : 'Hola! Estoy buscando un departamento en venta en Buenos Aires. ¿Podrían ayudarme?')"
          target="_blank"
          rel="noopener"
          class="br-btn-wa d-inline-flex"
          style="width: auto; padding: 0.65rem 1.5rem"
        >
          {{ t('ventas.noResults.wa') }}
        </a>
      </div>

      <div v-else id="catalogo-grid">
        <div v-for="s in filtered" :key="s.id" class="br-prop-card">
          <div class="br-prop-img" @click="goTo(s)">
            <img v-if="s.fotos?.[0]" :src="s.fotos[0]" :alt="s.titulo" loading="lazy" />
            <div v-else class="br-prop-img-placeholder">📸</div>
            <div class="br-prop-badges">
              <span v-if="s.esPropio" class="br-badge br-badge-propio">{{ t('ventas.card.propio') }}</span>
              <span
                class="br-badge"
                :class="{
                  'br-badge-disponible': s.disponibilidad === 'disponible',
                  'br-badge-reservado': s.disponibilidad === 'reservado',
                  'br-badge-nodisponible': s.disponibilidad !== 'disponible' && s.disponibilidad !== 'reservado',
                }"
              >
                {{
                  s.disponibilidad === 'disponible'
                    ? t('ventas.card.disponible')
                    : s.disponibilidad === 'reservado'
                      ? t('ventas.card.reservado')
                      : t('ventas.card.vendido')
                }}
              </span>
              <span v-if="s.fotos && s.fotos.length > 1" class="br-badge" style="background: rgba(0, 0, 0, 0.6); color: #fff; margin-left: auto">
                📷 {{ s.fotos.length }}
              </span>
            </div>
          </div>
          <div class="br-prop-body">
            <div class="br-prop-clickzone" @click="goTo(s)">
              <div class="br-prop-location">
                {{ s.barrio }} · <em style="font-style: normal; font-weight: 500">{{ s.tipo }}</em>
              </div>
              <div v-if="s.direccion && s.direccionUrl" class="br-prop-direccion">
                <a :href="s.direccionUrl" target="_blank" rel="noopener" class="br-btn-ver-mapa" @click.stop>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                  </svg>
                  {{ s.direccion }} — {{ t('ventas.card.verMapa') }}
                </a>
              </div>
              <h2 class="br-prop-titulo">{{ s.titulo }}</h2>
              <div class="br-prop-precio-row">
                <template v-if="s.precio > 0">
                  <span class="br-precio">{{ s.moneda || 'USD' }} {{ s.precio.toLocaleString('es-AR') }}</span>
                  <span class="br-precio-sub">
                    <span v-if="s.superficie" class="br-tag-servicios">{{ s.superficie }} m²</span>
                    <span v-if="s.ambientes" class="br-tag-minimo">{{ s.ambientes }} {{ t('ventas.card.ambientes') }}</span>
                    <span v-if="s.aptoCredito" class="br-tag-servicios">{{ t('ventas.filtros.aptoCredito') }}</span>
                  </span>
                </template>
                <template v-else>
                  <span class="br-precio" style="font-size: 1rem; font-weight: 700">{{ t('ventas.card.consultarPrecio') }}</span>
                  <span class="br-precio-sub">
                    <span v-if="s.superficie" class="br-tag-servicios">{{ s.superficie }} m²</span>
                    <span v-if="s.ambientes" class="br-tag-minimo">{{ s.ambientes }} {{ t('ventas.card.ambientes') }}</span>
                  </span>
                </template>
              </div>
              <div class="br-amenities-row">
                <span v-for="a in s.amenities.slice(0, 4)" :key="a" class="br-amenity-tag">{{ amenityLabel(a) }}</span>
              </div>
              <p class="br-prop-desc">{{ truncate(s.descripcion, 120) }}</p>
            </div>
            <div class="br-prop-actions">
              <router-link :to="{ name: routeName('venta-detail', currentLocale), params: { id: s.id } }" class="br-btn-detalle-primary w-100 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
                  <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                </svg>
                {{ t('ventas.card.verDetalles') }}
              </router-link>
              <div class="br-btn-detalle-row">
                <a :href="whatsappUrl(waMessageFor(s))" target="_blank" rel="noopener" class="br-btn-wa-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
                    />
                  </svg>
                  {{ t('ventas.card.whatsapp') }}
                </a>
                <button type="button" class="br-btn-compartir" :title="t('ventas.card.compartir')" @click="share(s)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="br-toast" v-show="toast">{{ toast }}</div>
  </SiteLayout>
</template>

<style scoped>
.br-dept-hero-lite {
  background: linear-gradient(180deg, #0a0a12 0%, #12121c 100%);
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 96px 32px 48px;
}
.br-dept-hero-lite-content {
  max-width: 700px;
}
.br-dept-eyebrow {
  display: inline-block;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 6px 16px;
  border-radius: 100px;
  margin-bottom: 18px;
}
.br-dept-title-lite {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(28px, 5vw, 52px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
  margin-bottom: 12px;
}
.br-dept-sub-lite {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(14px, 1.5vw, 17px);
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 0;
}

.br-filtros-wrapper {
  position: sticky !important;
  top: 64px;
  margin-top: 0 !important;
}
@media (max-width: 1100px) {
  .br-filtros-wrapper {
    top: 58px;
  }
}
.br-catalogo-section {
  padding-top: 2rem !important;
}

.br-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  background: #111;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 100px;
  z-index: 2000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
</style>
