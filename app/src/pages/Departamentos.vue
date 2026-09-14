<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useRouter } from 'vue-router'
import { getAllRentals } from '../data/properties'
import type { RentalProperty } from '../data/properties'
import { whatsappUrl, truncate } from '../utils/format'
import SiteLayout from '../layouts/SiteLayout.vue'
import { routeName } from '../router'
import { useLocaleLinks } from '../i18n/useLocaleLinks'

const { t } = useI18n()
const router = useRouter()
const { currentLocale, hreflangLinks } = useLocaleLinks()

useHead({
  title:
    currentLocale === 'en'
      ? 'Short-term rental apartments in Buenos Aires — BairesRental'
      : 'Departamentos en alquiler temporario en Buenos Aires — BairesRental',
  meta: [
    {
      name: 'description',
      content:
        currentLocale === 'en'
          ? 'Verified short-term rental apartments in Buenos Aires: Palermo, Recoleta, Belgrano and more. Clear pricing and real support.'
          : 'Departamentos verificados en alquiler temporario en Buenos Aires: Palermo, Recoleta, Belgrano y más. Precio claro y soporte real.',
    },
  ],
  link: [
    { rel: 'canonical', href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/departamentos` },
    ...hreflangLinks,
  ],
})

const allRentals = await getAllRentals()
// "no disponible" listings are kept in the data for internal use but never shown publicly.
const visibleRentals = computed(() => allRentals.filter((r) => r.disponibilidad !== 'no disponible'))

// Card icon + i18n key for each amenity value stored on a listing. `lavarropas`
// only ever shows on cards — it isn't one of the filter checkboxes below,
// matching the original catalog's scope.
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
] as const

function amenityLabel(a: string) {
  const meta = AMENITY_META[a]
  return meta ? t(`departamentos.amenities.${meta.key}`) : `✦ ${a}`
}

function normalizarBarrio(b: string) {
  return b
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
const barrios = computed(() => [...new Set(visibleRentals.value.map((r) => normalizarBarrio(r.barrio)))].sort())

const PRECIO_MIN = 500
const PRECIO_MAX = 8000
const PRECIO_STEP = 100

const search = ref('')
const barrio = ref('')
const tipos = ref<string[]>([])
const precioMax = ref(PRECIO_MAX)
const amueblado = ref<'' | 'si' | 'no'>('')
const mascotas = ref(false)
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
function setAmueblado(v: 'si' | 'no') {
  amueblado.value = amueblado.value === v ? '' : v
}
function clearFilters() {
  search.value = ''
  barrio.value = ''
  tipos.value = []
  precioMax.value = PRECIO_MAX
  amueblado.value = ''
  mascotas.value = false
  soloBairesRental.value = false
  soloDisponibles.value = false
  amenitiesSel.value = []
}

const filtered = computed(() =>
  visibleRentals.value
    .filter((r) => {
      if (barrio.value && normalizarBarrio(r.barrio) !== barrio.value) return false
      if (tipos.value.length && !tipos.value.includes(r.tipo)) return false
      if (r.precio > 0 && (r.moneda === 'USD' || !r.moneda) && r.precio > precioMax.value) return false
      if (search.value.trim()) {
        const q = search.value.trim().toLowerCase()
        const hit = [r.titulo, r.barrio, r.tipo, r.descripcion, r.direccion].some((c) => c && c.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (amueblado.value === 'si' && !r.amueblado) return false
      if (amueblado.value === 'no' && r.amueblado) return false
      if (mascotas.value && !r.mascotas) return false
      if (soloBairesRental.value && !r.esPropio) return false
      if (soloDisponibles.value && r.disponibilidad !== 'disponible') return false
      if (amenitiesSel.value.length && !amenitiesSel.value.every((a) => r.amenities.includes(a))) return false
      return true
    })
    .sort((a, b) => {
      if (a.esPropio && !b.esPropio) return -1
      if (!a.esPropio && b.esPropio) return 1
      const order: Record<string, number> = { disponible: 0, reservado: 1, 'no disponible': 2 }
      return (order[a.disponibilidad] ?? 0) - (order[b.disponibilidad] ?? 0)
    }),
)

const activeFilterCount = computed(() => {
  let n = 0
  if (barrio.value) n++
  if (tipos.value.length) n++
  if (precioMax.value < PRECIO_MAX) n++
  if (amueblado.value) n++
  if (amenitiesSel.value.length) n++
  if (mascotas.value) n++
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
function goTo(r: RentalProperty) {
  router.push({ name: routeName('departamento-detail', currentLocale), params: { id: r.id } })
}
// `window` doesn't exist during the vite-ssg prerender pass (Node) — this
// function's result gets baked straight into a template :href, so it must
// resolve without touching window, unlike share() below (browser-only, runs
// from a click handler, never evaluated at SSR time).
const SITE_URL = 'https://www.bairesrental.com.ar'
function detailHref(r: RentalProperty) {
  return router.resolve({ name: routeName('departamento-detail', currentLocale), params: { id: r.id } }).href
}
function waMessageFor(r: RentalProperty) {
  const base = r.whatsappMsg || `Hola! Me interesa ${r.titulo}`
  const ficha = r.fichaUrl || r.fotos
  const link = `${SITE_URL}${detailHref(r)}`
  return `${ficha ? `${base}\n\nFotos / ficha: ${ficha}` : base}\n\nLink BairesRental: ${link}\n\nCod: ${r.id}`
}

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}
async function share(r: RentalProperty) {
  const url = `${window.location.origin}${detailHref(r)}`
  if (navigator.share) {
    try {
      await navigator.share({ title: `${r.titulo} — BairesRental`, url })
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  } else {
    await navigator.clipboard.writeText(url)
    showToast(currentLocale === 'en' ? 'Link copied ✓' : 'Link copiado al portapapeles ✓')
  }
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function formatFecha(fecha?: string) {
  if (!fecha) return ''
  const [, mes, dia] = fecha.split('-')
  const idx = parseInt(mes, 10) - 1
  return currentLocale === 'en' ? `${MESES_EN[idx]} ${parseInt(dia, 10)}` : `${parseInt(dia, 10)} de ${MESES_ES[idx]}`
}
</script>

<template>
  <SiteLayout>
    <section class="br-dept-hero-lite">
      <div class="br-dept-hero-lite-content">
        <span class="br-dept-eyebrow">{{ t('departamentos.eyebrow') }}</span>
        <h1 class="br-dept-title-lite">{{ t('departamentos.title') }}</h1>
        <p class="br-dept-sub-lite">{{ t('departamentos.subtitle') }}</p>
      </div>
    </section>

    <div class="br-filtro-mob-overlay" :class="{ open: sheetOpen }" @click="sheetOpen = false"></div>

    <div class="br-filtros-wrapper" :class="{ 'mob-open': sheetOpen }">
      <div class="br-filtro-mob-bar">
        <button class="br-filtros-trigger-mob" type="button" @click="sheetOpen = true">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="10" y2="18" />
          </svg>
          {{ t('departamentos.filtros.filtrar') }}
          <span class="br-filtro-badge" v-show="activeFilterCount > 0">{{ activeFilterCount }}</span>
        </button>
        <span class="br-filtro-mob-count">{{ t('departamentos.filtros.propsCorto', { count: filtered.length, total: visibleRentals.length }) }}</span>
      </div>

      <div class="br-filtro-sheet-header">
        <button class="br-filtro-sheet-close-btn" type="button" :aria-label="t('departamentos.filtros.filtros')" @click="sheetOpen = false">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="br-filtro-sheet-title">{{ t('departamentos.filtros.filtros') }}</span>
        <button class="br-filtro-sheet-reset-btn" type="button" @click="clearFilters">{{ t('departamentos.filtros.limpiar') }}</button>
      </div>

      <div class="br-filtros-inner">
        <div class="br-filtros-collapsible">
          <div class="br-filtros-row">
            <div class="br-filtro-grupo br-busqueda-wrap">
              <span class="br-filtro-label">{{ t('departamentos.filtros.busqueda') }}</span>
              <input v-model="search" type="search" class="br-filtro-search" :placeholder="t('departamentos.filtros.busquedaPlaceholder')" autocomplete="off" />
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('departamentos.filtros.barrio') }}</span>
              <select v-model="barrio" class="br-filtro-select">
                <option value="">{{ t('departamentos.filtros.todos') }}</option>
                <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('departamentos.filtros.tipo') }}</span>
              <div class="br-filtro-pills">
                <button
                  v-for="tp in TIPOS"
                  :key="tp.value"
                  type="button"
                  class="br-pill-btn"
                  :class="{ active: tipos.includes(tp.value) }"
                  @click="toggleTipo(tp.value)"
                >
                  {{ t(`departamentos.filtros.${tp.labelKey}`) }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo br-precio-wrap">
              <div class="br-precio-top">
                <span class="br-filtro-label">{{ t('departamentos.filtros.precio') }}</span>
                <span id="label-precio">USD {{ precioMax.toLocaleString('es-AR') }}</span>
              </div>
              <input v-model.number="precioMax" type="range" class="br-range" :min="PRECIO_MIN" :max="PRECIO_MAX" :step="PRECIO_STEP" />
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('departamentos.filtros.amueblado') }}</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn" :class="{ active: amueblado === 'si' }" @click="setAmueblado('si')">{{ t('departamentos.filtros.si') }}</button>
                <button type="button" class="br-pill-btn" :class="{ active: amueblado === 'no' }" @click="setAmueblado('no')">{{ t('departamentos.filtros.no') }}</button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('departamentos.filtros.mascotas') }}</span>
              <label class="br-toggle-wrap">
                <input v-model="mascotas" type="checkbox" />
              </label>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">BairesRental</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-baires" :class="{ active: soloBairesRental }" @click="soloBairesRental = !soloBairesRental">
                  {{ t('departamentos.filtros.baires') }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('departamentos.filtros.disponibilidad') }}</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-disponible" :class="{ active: soloDisponibles }" @click="soloDisponibles = !soloDisponibles">
                  {{ t('departamentos.filtros.disponible') }}
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

            <span class="br-contador-inline">{{ t('departamentos.filtros.propsCorto', { count: filtered.length, total: visibleRentals.length }) }}</span>
            <button type="button" class="br-btn-limpiar" @click="clearFilters">{{ t('departamentos.filtros.limpiar') }}</button>
          </div>
        </div>
      </div>

      <div class="br-filtro-sheet-footer">
        <button type="button" class="br-filtro-sheet-apply-btn" @click="sheetOpen = false">
          {{ t('departamentos.filtros.verResultadosCount', { count: filtered.length }) }}
        </button>
      </div>
    </div>

    <div class="br-catalogo-section">
      <div v-if="!filtered.length" class="text-center py-5">
        <div class="mb-3" style="font-size: 3rem">🔍</div>
        <h4 class="mb-2" style="font-family: 'DM Sans', sans-serif">{{ t('departamentos.noResults.title') }}</h4>
        <p class="text-muted mb-4" style="font-family: 'DM Sans', sans-serif">{{ t('departamentos.noResults.sub') }}</p>
        <a
          :href="whatsappUrl(currentLocale === 'en' ? 'Hi! I am looking for an apartment in Buenos Aires. Could you help me?' : 'Hola! Estoy buscando un departamento en Buenos Aires. ¿Podrían ayudarme?')"
          target="_blank"
          rel="noopener"
          class="br-btn-wa d-inline-flex"
          style="width: auto; padding: 0.65rem 1.5rem"
        >
          {{ t('departamentos.noResults.wa') }}
        </a>
      </div>

      <div v-else id="catalogo-grid">
        <div v-for="r in filtered" :key="r.id" class="br-prop-card">
          <div class="br-prop-img" @click="goTo(r)">
            <img v-if="r.imagen" :src="r.imagen" :alt="r.titulo" loading="lazy" />
            <div v-else class="br-prop-img-placeholder">📸</div>
            <div class="br-prop-badges">
              <span v-if="r.esPropio" class="br-badge br-badge-propio">{{ t('departamentos.card.propio') }}</span>
              <span
                class="br-badge"
                :class="{
                  'br-badge-disponible': r.disponibilidad === 'disponible',
                  'br-badge-reservado': r.disponibilidad === 'reservado',
                  'br-badge-nodisponible': r.disponibilidad !== 'disponible' && r.disponibilidad !== 'reservado',
                }"
              >
                {{
                  r.disponibilidad === 'disponible'
                    ? t('departamentos.card.disponible')
                    : r.disponibilidad === 'reservado'
                      ? t('departamentos.card.reservado')
                      : t('departamentos.card.noDisponible')
                }}
              </span>
            </div>
          </div>
          <div class="br-prop-body">
            <div class="br-prop-clickzone" @click="goTo(r)">
              <div class="br-prop-location">
                {{ r.barrio }} · <em style="font-style: normal; font-weight: 500">{{ r.tipo }}</em>
                <span v-if="r.mascotas" class="br-mascota-inline">{{ t('departamentos.card.mascotas') }}</span>
              </div>
              <div v-if="r.direccion && r.direccionUrl" class="br-prop-direccion">
                <a :href="r.direccionUrl" target="_blank" rel="noopener" class="br-btn-ver-mapa" @click.stop>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                  </svg>
                  {{ r.direccion }} — {{ t('departamentos.card.verMapa') }}
                </a>
              </div>
              <h2 class="br-prop-titulo">{{ r.titulo }}</h2>
              <div v-if="r.disponibilidad === 'disponible' && r.disponibleDesde" class="br-prop-desde">
                {{ t('departamentos.card.disponibleDesde') }} <strong>{{ formatFecha(r.disponibleDesde) }}</strong>
              </div>
              <div class="br-prop-precio-row">
                <template v-if="r.precio > 0">
                  <span class="br-precio">{{ r.moneda || 'USD' }} {{ r.precio.toLocaleString('es-AR') }}</span>
                  <span class="br-precio-sub">
                    /{{ currentLocale === 'en' ? 'mo' : 'mes' }}
                    <span :class="r.serviciosIncluidos ? 'br-tag-servicios' : 'br-tag-servicios-aparte'">
                      {{ r.serviciosIncluidos ? t('departamentos.card.serviciosIncluidos') : t('departamentos.card.serviciosAparte') }}
                    </span>
                    <span v-if="r.minimoMeses > 1" class="br-tag-minimo">
                      {{ t('departamentos.card.minimo') }} {{ r.minimoMeses }} {{ r.minimoMeses === 1 ? t('departamentos.card.mes') : t('departamentos.card.meses') }}
                    </span>
                  </span>
                </template>
                <span v-else class="br-precio" style="font-size: 1rem; font-weight: 700">{{ t('departamentos.card.consultarPrecio') }}</span>
              </div>
              <div class="br-amenities-row">
                <span v-for="a in r.amenities.slice(0, 4)" :key="a" class="br-amenity-tag">{{ amenityLabel(a) }}</span>
              </div>
              <p class="br-prop-desc">{{ truncate(r.descripcion, 120) }}</p>
            </div>
            <div class="br-prop-actions">
              <router-link :to="{ name: routeName('departamento-detail', currentLocale), params: { id: r.id } }" class="br-btn-detalle-primary w-100 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
                  <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                </svg>
                {{ t('departamentos.card.verDetalles') }}
              </router-link>
              <div class="br-btn-detalle-row">
                <a :href="whatsappUrl(waMessageFor(r))" target="_blank" rel="noopener" class="br-btn-wa-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
                    />
                  </svg>
                  {{ t('departamentos.card.whatsapp') }}
                </a>
                <button type="button" class="br-btn-compartir" :title="t('departamentos.card.compartir')" @click="share(r)">
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
/* Hero + sticky-filter positioning are page-specific in the original static
   site too (departamentos.html's own inline <style>, not css/style.css) —
   ported the same way here instead of into the shared stylesheet. */
.br-dept-hero-lite {
  background: linear-gradient(180deg, #0a0a12 0%, #12121c 100%);
  min-height: 300px;
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
