<script setup lang="ts">
import { ref, computed } from 'vue'
import { collection, getFirestore } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import type { SaleProperty } from '~/types/property'
import { coordsFor } from '~/utils/geo'

// Reescrita sobre el sistema `br-*`, en paralelo a pages/departamentos/index.vue.
// Antes eran 118 líneas de utilidades de Bootstrap (container/row/card/h3) contra
// las 722 del ventas.html original: sin hero oscuro, sin las cards del catálogo,
// y con 8 de los 12 filtros faltando. No hizo falta CSS nuevo — salvo
// `.br-fotos-count`, las clases ya existían en br-catalog.css, compartidas con
// el catálogo de alquileres.
const { t, locale } = useI18n()
const localePath = useLocalePath()
const router = useRouter()

useSeoMeta({
  title: () => (locale.value === 'en' ? 'Apartments for sale in Buenos Aires — BairesRental' : 'Departamentos en venta en Buenos Aires — BairesRental'),
  description: () =>
    locale.value === 'en'
      ? 'Verified properties for sale in Buenos Aires, with all the information and photos you need to decide.'
      : 'Propiedades verificadas en venta en Buenos Aires, con toda la información y fotos que necesitás para decidir.',
})

const db = getFirestore()
const salesRef = useCollection<SaleProperty>(collection(db, 'sales'))
// "vendido" listings are kept in the data for internal use but never shown publicly.
const sales = computed(() => (salesRef.value ?? []).filter((s) => s.disponibilidad !== 'vendido'))

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
// Las etiquetas de amenities se comparten con el catálogo de alquileres —
// mismo set de valores, misma tabla de traducciones.
function amenityLabel(a: string) {
  const meta = AMENITY_META[a]
  return meta ? t(`departamentos.amenities.${meta.key}`) : `✦ ${a}`
}

const TIPOS = [
  { value: 'monoambiente', labelKey: 'tipoMono' },
  { value: '2 ambientes', labelKey: 'tipo2' },
  { value: '3 ambientes', labelKey: 'tipo3' },
  { value: '4+ ambientes', labelKey: 'tipo4' },
  { value: 'casa', labelKey: 'tipoCasa' },
  { value: 'PH', labelKey: 'tipoPH' },
] as const

// js/ventas.js:83 normaliza el barrio antes de armar el desplegable; sin esto
// "palermo" y "Palermo" aparecen como dos opciones distintas.
function normalizarBarrio(b: string) {
  return (b || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
const barrios = computed(() => [...new Set(sales.value.map((s) => normalizarBarrio(s.barrio)))].filter(Boolean).sort())

const PRECIO_MIN = 30000
const PRECIO_MAX = 500000
const PRECIO_STEP = 5000
const SUP_MAX = 300
const SUP_STEP = 5

const search = ref('')
const barrio = ref('')
const tipos = ref<string[]>([])
const precioMax = ref(PRECIO_MAX)
const superficieMin = ref(0)
const aptoCredito = ref(false)
const soloBairesRental = ref(false)
const soloDisponibles = ref(false)
const amenitiesSel = ref<string[]>([])

function toggleTipo(tp: string) {
  const i = tipos.value.indexOf(tp)
  if (i === -1) tipos.value.push(tp)
  else tipos.value.splice(i, 1)
}
function toggleAmenity(a: string) {
  const i = amenitiesSel.value.indexOf(a)
  if (i === -1) amenitiesSel.value.push(a)
  else amenitiesSel.value.splice(i, 1)
}
function clearFilters() {
  search.value = ''
  barrio.value = ''
  tipos.value = []
  precioMax.value = PRECIO_MAX
  superficieMin.value = 0
  aptoCredito.value = false
  soloBairesRental.value = false
  soloDisponibles.value = false
  amenitiesSel.value = []
}

const filtered = computed(() =>
  sales.value
    .filter((s) => {
      if (barrio.value && normalizarBarrio(s.barrio) !== barrio.value) return false
      if (tipos.value.length && !tipos.value.includes(s.tipo)) return false
      if (s.precio > 0 && (s.moneda === 'USD' || !s.moneda) && s.precio > precioMax.value) return false
      if (superficieMin.value && (s.superficie ?? 0) < superficieMin.value) return false
      if (aptoCredito.value && !s.aptoCredito) return false
      if (soloBairesRental.value && !s.esPropio) return false
      if (soloDisponibles.value && s.disponibilidad !== 'disponible') return false
      if (amenitiesSel.value.length && !amenitiesSel.value.every((a) => (s.amenities ?? []).includes(a))) return false
      if (search.value.trim()) {
        const q = search.value.trim().toLowerCase()
        const hit = [s.titulo, s.barrio, s.tipo, s.descripcion, s.direccion].some((c) => c && c.toLowerCase().includes(q))
        if (!hit) return false
      }
      return true
    })
    // js/ventas.js:233-238 — propias primero, después por disponibilidad.
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
  if (aptoCredito.value) n++
  if (soloBairesRental.value) n++
  if (soloDisponibles.value) n++
  if (amenitiesSel.value.length) n++
  if (search.value.trim()) n++
  return n
})

// ── Panel de filtros ─────────────────────────────────
// Bottom sheet en mobile, dropdown anclado en escritorio — ver
// useFilterPanel.ts y `.br-filtros-panel` en br-catalog.css.
const { open: panelOpen, toggle: togglePanel, close: closePanel } = useFilterPanel()

// ── Vista Lista / Mapa ────────────────────────────────
// NUXT-NEW, igual que en alquileres: el mapa es opt-in para que la lista
// conserve sus 3 columnas en escritorio.
const catalogView = ref<'list' | 'map'>('list')

const mapPoints = computed(() =>
  filtered.value.flatMap((s) => {
    const coords = coordsFor(s)
    if (!coords) return []
    return [{
      id: s.id,
      coords,
      titulo: s.titulo,
      subtitulo: `${s.barrio} · ${s.tipo}`,
      precio: s.precio > 0 ? `${s.moneda || 'USD'} ${s.precio.toLocaleString('es-AR')}` : t('ventas.card.consultarPrecio'),
      imagen: s.fotos?.[0],
      href: detailHref(s),
    }]
  }),
)

// ── Acciones de la card ───────────────────────────────
const SITE_URL = 'https://www.bairesrental.com.ar'
function detailHref(s: SaleProperty) {
  return localePath(`/ventas/${s.id}`)
}
function goTo(s: SaleProperty) {
  router.push(detailHref(s))
}
function waMessageFor(s: SaleProperty) {
  const base = s.whatsappMsg || `Hola! Me interesa ${s.titulo}`
  const link = `${SITE_URL}${detailHref(s)}`
  return `${s.fichaUrl ? `${base}\n\nFicha: ${s.fichaUrl}` : base}\n\nLink BairesRental: ${link}\n\nCod: ${s.id}`
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
      // el usuario canceló el share nativo — no hay nada que hacer
    }
  } else {
    await navigator.clipboard.writeText(url)
    showToast(t('ventas.linkCopiado'))
  }
}
</script>

<template>
  <div class="br-catalogo-page">
    <section class="br-dept-hero br-dept-hero-ventas">
      <div class="br-dept-hero-bg" aria-hidden="true"></div>
      <div class="br-dept-hero-content">
        <span class="br-dept-eyebrow">{{ t('ventas.eyebrow') }}</span>
        <h1 class="br-dept-title">{{ t('ventas.title') }} <span class="accent">{{ t('ventas.titleAccent') }}</span></h1>
        <p class="br-dept-sub">{{ t('ventas.subtitle') }}</p>
      </div>
    </section>

    <div class="br-filtros-overlay" :class="{ open: panelOpen }" @click="closePanel"></div>

    <div class="br-filtros-wrapper" :class="{ open: panelOpen }">
      <div class="br-filtros-bar">
        <div class="br-quick-search">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="search" type="search" :placeholder="t('ventas.filtros.busquedaPlaceholder')" autocomplete="off" />
        </div>

        <select v-model="barrio" class="br-quick-barrio">
          <option value="">{{ t('ventas.filtros.barrio') }}</option>
          <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
        </select>

        <div class="br-quick-tipos">
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

        <button
          class="br-filtros-trigger"
          :class="{ active: panelOpen }"
          type="button"
          :aria-expanded="panelOpen"
          @click="togglePanel"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="10" y2="18" />
          </svg>
          {{ t('ventas.filtros.filtrar') }}
          <span v-show="activeFilterCount > 0" class="br-filtro-badge">{{ activeFilterCount }}</span>
        </button>

        <div class="br-filtros-bar-end">
          <span class="br-contador-inline">
            {{ t('ventas.filtros.propsCorto', { count: filtered.length, total: sales.length }) }}
          </span>
          <button v-show="activeFilterCount > 0" type="button" class="br-btn-limpiar" @click="clearFilters">
            {{ t('ventas.filtros.limpiar') }}
          </button>
          <div class="br-catalogo-view-toggle">
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'list' }" @click="catalogView = 'list'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {{ t('ventas.filtros.vistaLista') }}
            </button>
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'map' }" @click="catalogView = 'map'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {{ t('ventas.filtros.vistaMapa') }}
            </button>
          </div>
        </div>
      </div>

      <div class="br-filtro-sheet-header">
        <button class="br-filtro-sheet-close-btn" type="button" :aria-label="t('ventas.filtros.filtros')" @click="closePanel">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="br-filtro-sheet-title">{{ t('ventas.filtros.filtros') }}</span>
        <button class="br-filtro-sheet-reset-btn" type="button" @click="clearFilters">{{ t('ventas.filtros.limpiar') }}</button>
      </div>

      <div class="br-filtros-panel">
        <div class="br-filtros-inner">
        <div class="br-filtros-collapsible">
          <div class="br-filtros-row">
            <div class="br-filtro-grupo br-busqueda-wrap br-filtro-grupo-dup">
              <span class="br-filtro-label">{{ t('ventas.filtros.busqueda') }}</span>
              <input v-model="search" type="search" class="br-filtro-search" :placeholder="t('ventas.filtros.busquedaPlaceholder')" autocomplete="off" />
            </div>

            <div class="br-filtro-grupo br-filtro-grupo-dup">
              <span class="br-filtro-label">{{ t('ventas.filtros.barrio') }}</span>
              <select v-model="barrio" class="br-filtro-select">
                <option value="">{{ t('ventas.filtros.todos') }}</option>
                <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div class="br-filtro-grupo br-filtro-grupo-dup">
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

            <!-- Superficie mín.: el ref existía y ya filtraba, pero no había
                 ningún control atado a él — estado muerto. -->
            <div class="br-filtro-grupo br-precio-wrap">
              <div class="br-precio-top">
                <span class="br-filtro-label">{{ t('ventas.filtros.superficie') }}</span>
                <span id="label-superficie">
                  {{ superficieMin > 0 ? `${superficieMin} m²` : t('ventas.filtros.superficieCualquiera') }}
                </span>
              </div>
              <input v-model.number="superficieMin" type="range" class="br-range" :min="0" :max="SUP_MAX" :step="SUP_STEP" />
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.credito') }}</span>
              <div class="br-filtro-pills">
                <button type="button" class="br-pill-btn br-pill-btn-baires" :class="{ active: aptoCredito }" @click="aptoCredito = !aptoCredito">
                  {{ t('ventas.filtros.aptoCredito') }}
                </button>
              </div>
            </div>

            <div class="br-filtro-grupo">
              <span class="br-filtro-label">{{ t('ventas.filtros.bairesLabel') }}</span>
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
          </div>
        </div>
      </div>

        <div class="br-filtro-sheet-footer">
          <button type="button" class="br-filtro-sheet-reset-btn br-reset-escritorio" @click="clearFilters">
            {{ t('ventas.filtros.limpiar') }}
          </button>
          <button class="br-filtro-sheet-apply-btn" type="button" @click="closePanel">
            {{ t('ventas.filtros.verResultadosCount', { count: filtered.length }) }}
          </button>
        </div>
      </div>
    </div>

    <section class="br-catalogo-section">
      <div class="br-catalogo-split">
        <div class="br-catalogo-list" :class="{ 'br-lista-oculta': catalogView === 'map' }">
          <div v-if="!filtered.length" class="br-sin-resultados">
            <div style="font-size: 3rem; margin-bottom: 0.5rem">🔍</div>
            <h2>{{ t('ventas.noResultsTitle') }}</h2>
            <p>{{ t('ventas.noResultsSub') }}</p>
            <a
              :href="whatsappUrl(t('ventas.waGenerico'))"
              target="_blank"
              rel="noopener"
              class="br-btn-wa d-inline-flex"
              style="width: auto; padding: 0.65rem 1.5rem"
            >
              {{ t('ventas.noResultsWa') }}
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
                  <span v-if="(s.fotos?.length ?? 0) > 1" class="br-badge br-fotos-count">📷 {{ s.fotos.length }}</span>
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
                    <span v-if="s.precio > 0" class="br-precio">{{ s.moneda || 'USD' }} {{ s.precio.toLocaleString('es-AR') }}</span>
                    <span v-else class="br-precio" style="font-size: 1rem; font-weight: 700">{{ t('ventas.card.consultarPrecio') }}</span>
                    <span class="br-precio-sub">
                      <span v-if="s.superficie" class="br-tag-servicios">{{ s.superficie }} m²</span>
                      <span v-if="s.ambientes" class="br-tag-minimo">{{ s.ambientes }} {{ t('ventas.card.amb') }}</span>
                      <span v-if="s.aptoCredito" class="br-tag-servicios">{{ t('ventas.card.aptoCredito') }}</span>
                    </span>
                  </div>
                  <div class="br-amenities-row">
                    <span v-for="a in (s.amenities ?? []).slice(0, 4)" :key="a" class="br-amenity-tag">{{ amenityLabel(a) }}</span>
                  </div>
                  <p class="br-prop-desc">{{ truncate(s.descripcion, 120) }}</p>
                </div>
                <div class="br-prop-actions">
                  <NuxtLink :to="detailHref(s)" class="br-btn-detalle-primary w-100 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
                      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                    </svg>
                    {{ t('ventas.card.verDetalles') }}
                  </NuxtLink>
                  <div class="br-btn-detalle-row">
                    <a :href="whatsappUrl(waMessageFor(s))" target="_blank" rel="noopener" class="br-btn-wa-outline" @click.stop>
                      <IconWhatsapp :size="15" />
                      {{ t('ventas.card.whatsapp') }}
                    </a>
                    <button type="button" class="br-btn-compartir" :title="t('ventas.card.verDetalles')" @click.stop="share(s)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="br-catalogo-map-panel" :class="{ 'br-mapa-oculto': catalogView === 'list' }">
          <ClientOnly>
            <CatalogMap v-if="catalogView === 'map'" :points="mapPoints" :ver-detalles="t('ventas.card.verDetalles')" />
          </ClientOnly>
        </div>
      </div>
    </section>

    <div v-if="toast" class="br-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
/* Misma compactación de filtros que el catálogo de alquileres — ventas.html
   traía su propio bloque equivalente. Acotada a `.br-filtros-row` por el
   mismo motivo: sueltos, estos selectores achicaban también los controles
   de la barra sticky. */
.br-catalogo-page {
  line-height: 1.7;
}
.br-filtros-row {
  gap: 9px;
}
.br-filtros-row .br-filtro-grupo {
  gap: 2px;
}
.br-filtros-row .br-filtro-label {
  font-size: 11px;
}
.br-filtros-row .br-pill-btn {
  font-size: 11px;
  padding: 3px 9px;
}
.br-filtros-row .br-filtro-select {
  font-size: 11px;
  padding: 4px 10px;
  min-width: 110px;
}
.br-filtros-row #label-precio,
.br-filtros-row #label-superficie {
  font-size: 11px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  color: var(--br-azul);
}
.br-filtros-row .br-precio-wrap {
  min-width: 130px;
}
@media (max-width: 768px) {
  .br-filtros-row .br-amenity-check {
    font-size: 10px;
    padding: 2px 6px;
    line-height: 1.2;
  }
}

/* Hero de ventas: mismo bloque que el de alquileres pero con el fondo de
   gradiente radial de ventas.html:158-170 en vez del crossfade de fotos. */
.br-dept-hero-ventas {
  position: relative;
  min-height: max(380px, 50vh);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(160deg, #0a0a12 0%, #0f0a1e 50%, #070710 100%);
}
.br-dept-hero-ventas .br-dept-hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(26, 111, 232, 0.18) 0%, rgba(80, 40, 180, 0.1) 50%, transparent 80%);
}
.br-dept-hero-ventas .br-dept-hero-content {
  position: relative;
  z-index: 11;
  max-width: 740px;
  padding: 48px 32px 64px;
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
.br-dept-title {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(30px, 7vw, 76px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #fff;
  margin-bottom: 16px;
}
.br-dept-title .accent {
  color: var(--azul);
}
.br-dept-sub {
  font-family: 'DM Sans', sans-serif;
  /* 14px y no el clamp(14px,1.5vw,17px) propio: en el estático
     `p { font-size:14px !important }` de css/style.css siempre le ganaba. */
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 400;
  margin-bottom: 0;
  line-height: 1.6;
}

.br-sin-resultados {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--br-gris-txt);
}
.br-sin-resultados h2 {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111;
  margin-bottom: 0.4rem;
}
.br-sin-resultados p {
  margin-bottom: 1.2rem;
}

.br-toast {
  position: fixed;
  left: 50%;
  bottom: 2rem;
  transform: translateX(-50%);
  background: rgba(17, 17, 17, 0.92);
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  padding: 0.6rem 1.1rem;
  border-radius: 100px;
  z-index: 1100;
}
</style>
