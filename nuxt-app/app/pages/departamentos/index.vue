<script setup lang="ts">
import { ref, computed } from 'vue'
import { collection, getFirestore, query, where } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import type { RentalProperty } from '~/types/property'
import { coordsFor } from '~/utils/geo'

// Ported from app/src/pages/Departamentos.vue. The one real change vs. the
// old file: getAllRentals() (a one-time SSR-admin-SDK/client-SDK fetch
// split, see app/src/data/properties.ts) is replaced by useCollection
// straight against the `rentals` collection — same composable, same
// client SDK, on both server and client, confirmed working for real
// per-request SSR in N0. firestore.rules already allows public reads here.
//
// Filter logic (search/barrio/tipo/precio/amueblado/amenities/etc.) is
// ported as-is — per app/README.md this app doesn't have full filter
// parity with the original static site (no URL query-param sync), and
// that's a known pre-existing gap, not something to fix in this milestone.
const { t, locale } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
// Modo vendedor (?vendor=1): sin botones de WhatsApp, "Compartir" ancho con
// texto, sin el botón "Comunidad" del hero. Ver useVendorMode.ts.
const { isVendor, vendorLink } = useVendorMode()

useSeoMeta({
  title: () =>
    locale.value === 'en'
      ? 'Short-term rental apartments in Buenos Aires — BairesRental'
      : 'Departamentos en alquiler temporario en Buenos Aires — BairesRental',
  description: () =>
    locale.value === 'en'
      ? 'Verified short-term rental apartments in Buenos Aires: Palermo, Recoleta, Belgrano and more. Clear pricing and real support.'
      : 'Departamentos verificados en alquiler temporario en Buenos Aires: Palermo, Recoleta, Belgrano y más. Precio claro y soporte real.',
})

const db = getFirestore()
// El `where` NO es una optimización y no se puede sacar: firestore.rules sólo
// le deja leer a un anónimo los documentos aprobados, y Firestore valida una
// query ANALIZÁNDOLA contra la regla, no mirando lo que devuelve. Sin este
// filtro no llegan "menos propiedades": rebota la query entera y el catálogo
// queda vacío. Ver el encabezado de utils/revision.ts.
const allRentals = useCollection<RentalProperty>(query(collection(db, 'rentals'), where('revision', '==', 'aprobada')))
// "no disponible" listings are kept in the data for internal use but never shown publicly.
const visibleRentals = computed(() => (allRentals.value ?? []).filter((r) => r.disponibilidad !== 'no disponible'))

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

// ── Vista Lista / Mapa ────────────────────────────────
// NUXT-NEW: no existe en el sitio estático. El default es 'list' a todo
// ancho: con el mapa fijo al costado la grilla bajaba de 3 a 2 columnas en
// escritorio, así que el mapa es opt-in y la lista conserva las 3 columnas.
const catalogView = ref<'list' | 'map'>('list')

// Puntos del mapa, ya normalizados para CatalogMap. `coordsFor` prioriza el
// lat/lng guardado en la propiedad y cae al que se pueda parsear de
// direccionUrl; las que no se pueden ubicar quedan afuera. Ver geo.ts.
const mapPoints = computed(() =>
  filtered.value.flatMap((r) => {
    const coords = coordsFor(r)
    if (!coords) return []
    return [{
      id: r.id,
      coords,
      titulo: r.titulo,
      subtitulo: `${r.barrio} · ${r.tipo}`,
      precio: r.precio > 0 ? `${r.moneda || 'USD'} ${r.precio.toLocaleString('es-AR')}` : t('departamentos.card.consultarPrecio'),
      imagen: r.imagen,
      href: detailHref(r),
    }]
  }),
)

// ── Panel de filtros ─────────────────────────────────
// Bottom sheet en mobile, dropdown anclado en escritorio — ver
// useFilterPanel.ts y `.br-filtros-panel` en br-catalog.css.
const { open: panelOpen, toggle: togglePanel, close: closePanel } = useFilterPanel()

// ── Card actions ──────────────────────────────────────
function goTo(r: RentalProperty) {
  router.push(detailHref(r))
}
const SITE_URL = 'https://www.bairesrental.com.ar'
function detailHref(r: RentalProperty) {
  return vendorLink(localePath(`/departamentos/${r.id}`))
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
    showToast(locale.value === 'en' ? 'Link copied ✓' : 'Link copiado al portapapeles ✓')
  }
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function formatFecha(fecha?: string) {
  if (!fecha) return ''
  const [, mes, dia] = fecha.split('-')
  const idx = parseInt(mes, 10) - 1
  return locale.value === 'en' ? `${MESES_EN[idx]} ${parseInt(dia, 10)}` : `${parseInt(dia, 10)} de ${MESES_ES[idx]}`
}
</script>

<template>
  <div class="br-catalogo-page">
    <!-- Hero completo, restaurado desde departamentos.html:533-563. Estaba
         reducido a `.br-dept-hero-lite`: un gradiente plano de 300px, sin
         fotos, con el título a menos de la mitad de tamaño y sin acento,
         sin la 2da línea del subtítulo, sin los dos botones y sin el
         indicador de scroll. -->
    <section class="br-dept-hero">
      <div class="br-dept-hero-bg" aria-hidden="true">
        <div class="br-slide br-slide-1"></div>
        <div class="br-slide br-slide-2"></div>
        <div class="br-slide br-slide-3"></div>
      </div>
      <div class="br-dept-hero-content">
        <span class="br-dept-eyebrow">{{ t('departamentos.eyebrow') }}</span>
        <h1 class="br-dept-title">
          <span>{{ t('departamentos.title') }}</span>
          <span class="accent">{{ t('departamentos.titleAccent') }}</span>
        </h1>
        <p class="br-dept-sub">
          <span>{{ t('departamentos.subtitle') }}</span><br />
          <span>{{ t('departamentos.subtitle2') }}</span>
        </p>
        <div class="br-dept-hero-btns">
          <!-- Apuntaba directo al PDF (/docs/requisitos-alquiler.pdf), que
               abría una pestaña nueva con un documento sin traducir y pesado
               de leer en el celular. Ahora va a /requisitos, la versión web
               del mismo material; el PDF se sigue pudiendo bajar desde ahí. -->
          <NuxtLink :to="vendorLink(localePath('/requisitos'))" class="br-dept-hero-btn">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            {{ t('departamentos.reqBtn') }}
          </NuxtLink>
          <a
            v-if="!isVendor"
            href="https://chat.whatsapp.com/FeYh0RpkLqN0JnWiEi5ucG?mode=gi_t"
            target="_blank"
            rel="noopener"
            class="br-dept-hero-btn"
          >
            <IconWhatsapp :size="12" />
            {{ t('departamentos.comunidadBtn') }}
          </a>
        </div>
      </div>
      <div class="br-dept-scroll-hint" aria-hidden="true">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        <span>{{ t('departamentos.scrollHint') }}</span>
      </div>
    </section>

    <div class="br-filtros-overlay" :class="{ open: panelOpen }" @click="closePanel"></div>

    <div class="br-filtros-wrapper" :class="{ open: panelOpen }">
      <div class="br-filtros-bar">
        <div class="br-quick-search">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="search" type="search" :placeholder="t('departamentos.filtros.busquedaPlaceholder')" autocomplete="off" />
        </div>

        <select v-model="barrio" class="br-quick-barrio">
          <option value="">{{ t('departamentos.filtros.barrio') }}</option>
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
            {{ t(`departamentos.filtros.${tp.labelKey}`) }}
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
          {{ t('departamentos.filtros.filtrar') }}
          <span v-show="activeFilterCount > 0" class="br-filtro-badge">{{ activeFilterCount }}</span>
        </button>

        <div class="br-filtros-bar-end">
          <span class="br-contador-inline">
            {{ t('departamentos.filtros.propsCorto', { count: filtered.length, total: visibleRentals.length }) }}
          </span>
          <button v-show="activeFilterCount > 0" type="button" class="br-btn-limpiar" @click="clearFilters">
            {{ t('departamentos.filtros.limpiar') }}
          </button>
          <div class="br-catalogo-view-toggle">
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'list' }" @click="catalogView = 'list'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {{ t('departamentos.filtros.vistaLista') }}
            </button>
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'map' }" @click="catalogView = 'map'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {{ t('departamentos.filtros.vistaMapa') }}
            </button>
          </div>
        </div>
      </div>

      <div class="br-filtro-sheet-header">
        <button class="br-filtro-sheet-close-btn" type="button" :aria-label="t('departamentos.filtros.filtros')" @click="closePanel">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="br-filtro-sheet-title">{{ t('departamentos.filtros.filtros') }}</span>
        <button class="br-filtro-sheet-reset-btn" type="button" @click="clearFilters">{{ t('departamentos.filtros.limpiar') }}</button>
      </div>

      <div class="br-filtros-panel">
        <div class="br-filtros-inner">
          <div class="br-filtros-collapsible">
            <div class="br-filtros-row">
              <!-- Buscador / barrio / tipo también acá: en escritorio la barra
                   rápida está oculta y estos son los controles visibles, como
                   en departamentos.html:598-620. Comparten los mismos refs que
                   los de la barra rápida, así que el estado es uno solo. -->
              <div class="br-filtro-grupo br-busqueda-wrap br-filtro-grupo-dup">
                <span class="br-filtro-label">{{ t('departamentos.filtros.busqueda') }}</span>
                <input
                  v-model="search"
                  type="search"
                  class="br-filtro-search"
                  :placeholder="t('departamentos.filtros.busquedaPlaceholder')"
                  autocomplete="off"
                />
              </div>

              <div class="br-filtro-grupo br-filtro-grupo-dup">
                <span class="br-filtro-label">{{ t('departamentos.filtros.barrio') }}</span>
                <select v-model="barrio" class="br-filtro-select">
                  <option value="">{{ t('departamentos.filtros.todos') }}</option>
                  <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>

              <div class="br-filtro-grupo br-filtro-grupo-dup">
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
                  <label class="br-amenity-check">
                    <input v-model="mascotas" type="checkbox" />
                    <span>{{ t('departamentos.filtros.mascotas') }}</span>
                  </label>
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
            {{ t('departamentos.filtros.limpiar') }}
          </button>
          <button type="button" class="br-filtro-sheet-apply-btn" @click="closePanel">
            {{ t('departamentos.filtros.verResultadosCount', { count: filtered.length }) }}
          </button>
        </div>
      </div>
    </div>

    <div class="br-catalogo-section">
      <div class="br-catalogo-split">
        <div class="br-catalogo-list" :class="{ 'br-lista-oculta': catalogView === 'map' }">
          <div v-if="!filtered.length" class="text-center py-5">
            <div class="mb-3" style="font-size: 3rem">🔍</div>
            <h4 class="mb-2" style="font-family: 'DM Sans', sans-serif">{{ t('departamentos.noResults.title') }}</h4>
            <p class="text-muted mb-4" style="font-family: 'DM Sans', sans-serif">{{ t('departamentos.noResults.sub') }}</p>
            <a
              v-if="!isVendor"
              :href="whatsappUrl(locale === 'en' ? 'Hi! I am looking for an apartment in Buenos Aires. Could you help me?' : 'Hola! Estoy buscando un departamento en Buenos Aires. ¿Podrían ayudarme?')"
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
                    /{{ locale === 'en' ? 'mo' : 'mes' }}
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
                <span v-if="r.mascotas" class="br-amenity-tag">{{ t('departamentos.card.mascotas') }}</span>
                <span v-for="a in r.amenities.slice(0, 4)" :key="a" class="br-amenity-tag">{{ amenityLabel(a) }}</span>
              </div>
            </div>
            <div class="br-prop-actions">
              <div class="br-btn-detalle-row">
                <a v-if="!isVendor" :href="whatsappUrl(waMessageFor(r))" target="_blank" rel="noopener" class="br-btn-wa-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
                    />
                  </svg>
                  {{ t('departamentos.card.whatsapp') }}
                </a>
                <button
                  type="button"
                  class="br-btn-compartir"
                  :class="{ 'br-btn-compartir-full': isVendor }"
                  :title="t('departamentos.card.compartir')"
                  @click="share(r)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
                    />
                  </svg>
                  <span v-if="isVendor" class="br-btn-compartir-label">{{ t('departamentos.card.compartir') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>

        <div class="br-catalogo-map-panel" :class="{ 'br-mapa-oculto': catalogView === 'list' }">
          <ClientOnly>
            <CatalogMap v-if="catalogView === 'map'" :points="mapPoints" :ver-detalles="t('departamentos.card.verDetalles')" />
          </ClientOnly>
        </div>
      </div>
    </div>

    <div class="br-toast" v-show="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
/* ── Filtros compactos ─────────────────────────────────────────────
   Portado de departamentos.html:366-376, un bloque de overrides propios de
   la página. Son px explícitos a propósito: en el estático achicaban la
   barra de filtros a dos filas.
   Van acotados a `.br-filtros-row` — o sea, al contenido del panel. Sueltos
   también pegaban en la barra sticky (`.br-pill-btn`, `.br-btn-limpiar`),
   donde los controles tienen que leerse a tamaño normal. El padding de
   `.br-filtros-inner` lo fija ahora la hoja compartida según el panel sea
   dropdown o sheet. */
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
.br-filtros-row #label-precio {
  font-size: 11px;
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

/* departamentos.html cargaba css/style.css, que ponía
   `body { line-height: 1.7 }` por encima de Bootstrap. Esa hoja ya no se
   carga (ver public/css/legacy-template.css), así que el valor se
   reproduce acá, acotado a esta página. */
.br-catalogo-page {
  line-height: 1.7;
}

/* Hero + sticky-filter positioning are page-specific in the original static
   site too (departamentos.html's own inline <style>, not css/style.css) —
   ported the same way here instead of into the shared stylesheet. */
.br-dept-hero {
  position: relative;
  min-height: max(420px, 58vh);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  background: #0a0a12;
}
.br-dept-hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
/* Velo oscuro por encima de las fotos, para que el texto se lea. */
.br-dept-hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 10;
  background: linear-gradient(to bottom, rgba(10, 10, 18, 0.55) 0%, rgba(10, 10, 18, 0.72) 100%);
}
/* Crossfade de 3 fotos, 21s de ciclo con 7s de desfasaje entre cada una.
   Los JPG originales pesaban 2,6 / 3,5 / 3,6 MB (9,6 MB en total, todos en
   la ruta crítica porque la animación arranca en t=0). Se reencodearon a
   WebP de 1920px: 752 KB entre las tres. */
.br-slide {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  animation: brSlide 21s infinite;
}
.br-slide-1 {
  background-image: url('/images/galeria-2.webp');
  animation-delay: 0s;
}
.br-slide-2 {
  background-image: url('/images/galeria-4.webp');
  animation-delay: 7s;
}
.br-slide-3 {
  background-image: url('/images/galeria-6.webp');
  animation-delay: 14s;
}
@keyframes brSlide {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  26% {
    opacity: 1;
  }
  38% {
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
}
/* Con prefers-reduced-motion se queda fija la primera foto. */
@media (prefers-reduced-motion: reduce) {
  .br-slide {
    animation: none;
  }
  .br-slide-1 {
    opacity: 1;
  }
}
.br-dept-hero-content {
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
@media (max-width: 600px) {
  .br-dept-eyebrow {
    font-size: 10px;
    letter-spacing: 0.1em;
    padding: 5px 12px;
  }
}
.br-dept-title {
  font-family: 'DM Sans', sans-serif;
  font-size: clamp(30px, 7vw, 96px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #fff;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.br-dept-title .accent {
  color: var(--azul);
  white-space: nowrap;
}
.br-dept-sub {
  font-family: 'DM Sans', sans-serif;
  /* 14px, no el clamp(14px,1.5vw,17px) propio: en el estático
     `p { font-size:14px !important }` de css/style.css siempre le ganaba,
     así que es lo que se ve en producción. Ver el mismo caso en
     tickets.vue. */
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 400;
  margin-bottom: 28px;
  line-height: 1.6;
}
@media (min-width: 1185px) {
  .br-dept-title {
    font-size: clamp(30px, calc(7vw - 10px), 86px);
  }
  /* A partir de 1185px el estático sí subía el subtítulo a 21px: esa regla
     era `.br-dept-sub { font-size: 21px !important }`, con más especificidad
     que el `p` de la hoja legacy, así que ganaba. */
  .br-dept-sub {
    font-size: 21px;
  }
}
.br-dept-hero-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* departamentos.html tenía .br-dept-req-btn y .br-dept-comunidad-btn con
   reglas idénticas; acá es una sola clase. */
.br-dept-hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 7px 16px;
  border-radius: 100px;
  text-decoration: none;
  transition: background 0.2s, color 0.2s, transform 0.2s;
}
.br-dept-hero-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  transform: translateY(-2px);
  text-decoration: none;
}
/* `pointer-events: none` no es cosmético: la caja del indicador es absoluta y
   va de borde a borde, con el mismo z-index que el contenido del hero. En
   viewports de poca altura (1280x720, 1440x800) el contenido se comprime hasta
   quedar dentro de esa franja y el indicador —decorativo, `aria-hidden`— se
   comía los clicks de los botones "Requisitos de alquiler" y "Comunidad". */
.br-dept-scroll-hint {
  position: absolute;
  bottom: 2.5rem;
  left: 0;
  right: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  z-index: 11;
}
.br-dept-scroll-hint svg {
  animation: bounceY 1.8s ease-in-out infinite;
}
@keyframes bounceY {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(6px);
  }
}
@media (max-width: 1060px) {
  .br-dept-scroll-hint {
    display: none;
  }
}
/* Arriba de 1060px el indicador se muestra y ocupa los ~87px de abajo del hero
   (2,5rem de `bottom` + su alto). Con los 64px de padding de base los botones
   caían encima en pantallas bajas; acá se les reserva el espacio. Abajo de
   1060px el indicador no existe, así que el padding sigue siendo 64px. */
@media (min-width: 1061px) {
  .br-dept-hero-content {
    padding-bottom: 112px;
  }
}

/* El `:not(.open)` importa: con el panel abierto en mobile la hoja compartida
   pasa el wrapper a `position: fixed; inset: 0` para el bottom sheet, y este
   `sticky !important` le empataba en especificidad (una clase + el atributo de
   scope, igual que `.br-filtros-wrapper.open`) y ganaba por orden de fuente.
   Resultado: el sheet no ocupaba la pantalla, quedaba encajado donde estaba la
   barra. Acotarlo al estado cerrado saca el empate de la ecuación. */
.br-filtros-wrapper:not(.open) {
  position: sticky !important;
  top: 64px;
  margin-top: 0 !important;
}
@media (max-width: 1100px) {
  .br-filtros-wrapper:not(.open) {
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
