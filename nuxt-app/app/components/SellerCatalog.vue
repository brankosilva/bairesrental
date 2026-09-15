<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'
import { coordsFor } from '~/utils/geo'

// Catálogo de la página que comparte el vendedor (/l/:code), con los mismos
// filtros y la misma vista de mapa que el catálogo público.
//
// POR QUÉ ES UN COMPONENTE Y NO MÁS MARKUP EN LA PÁGINA
// -----------------------------------------------------
// pages/l/[code]/index.vue ya resuelve tres cosas distintas (link inválido,
// ficha de una propiedad, catálogo) más el conteo de conversiones. Meter acá
// ~10 refs de filtros y el toggle de vista lo volvía ilegible.
//
// POR QUÉ NO SE REUSA departamentos/index.vue
// -------------------------------------------
// Aquella página filtra UNA colección y la lee de Firestore con useCollection;
// acá las dos listas vienen ya resueltas en el payload de /api/l/:code (con el
// recorte de qué puede mostrar este vendedor, que es del servidor) y van
// MEZCLADAS en una sola grilla. Lo que sí se reusa es todo lo caro: las clases
// de br-catalog.css (barra, panel, pills, toggle, split lista/mapa) —que se
// cargan sitewide— y el componente CatalogMap.
//
// Los textos van en español y no con t(), como el resto de esta página:
// layouts/branded.vue no lleva selector de idioma a propósito (es un envío
// uno-a-uno y el vendedor ya sabe en qué idioma habla su cliente).
const props = defineProps<{
  rentals: (RentalProperty & { id: string })[]
  sales: (SaleProperty & { id: string })[]
  code: string
}>()

type Kind = 'rental' | 'sale'

// View-model unificado: alquileres y ventas tienen esquemas distintos (la
// portada de un alquiler es `imagen`, la de una venta es `fotos[0]`; sólo el
// alquiler tiene `mascotas`, sólo la venta tiene `superficie`), así que se
// normalizan una vez acá y el filtro, la grilla y el mapa trabajan sobre lo
// mismo.
interface Row {
  kind: Kind
  id: string
  titulo: string
  barrio: string
  tipo: string
  precio: number
  moneda: string
  disponibilidad: string
  amueblado: boolean
  mascotas: boolean
  amenities: string[]
  superficie: number
  aptoCredito: boolean
  imagen: string
  coords: [number, number] | null
  haystack: string
  href: string
}

function toRow(p: Record<string, unknown>, kind: Kind): Row {
  const r = p as unknown as RentalProperty & SaleProperty & { id: string }
  return {
    kind,
    id: r.id,
    titulo: r.titulo,
    barrio: r.barrio || '',
    tipo: r.tipo || '',
    precio: Number(r.precio) || 0,
    moneda: r.moneda || 'USD',
    disponibilidad: r.disponibilidad,
    amueblado: !!r.amueblado,
    mascotas: kind === 'rental' && !!r.mascotas,
    amenities: Array.isArray(r.amenities) ? r.amenities : [],
    superficie: kind === 'sale' ? Number(r.superficie) || 0 : 0,
    aptoCredito: kind === 'sale' && !!r.aptoCredito,
    imagen: kind === 'rental' ? r.imagen || '' : (Array.isArray(r.fotos) ? r.fotos[0] : '') || '',
    coords: coordsFor(r),
    haystack: [r.titulo, r.barrio, r.tipo, r.descripcion, r.direccion].filter(Boolean).join(' ').toLowerCase(),
    href: `/l/${props.code}/${encodeURIComponent(r.id)}`,
  }
}

// El orden que trae el payload ya pone primero las del vendedor (ownFirst en
// server/api/l/[code].get.ts). Lo único que se reordena acá es mandar las
// reservadas al final, como hace el catálogo público: siguen estando —el
// cliente puede preguntar igual— pero no arriba de todo. El sort de JS es
// estable, así que dentro de cada grupo se conserva el orden del servidor.
const rows = computed<Row[]>(() => {
  const all = [...props.rentals.map((r) => toRow(r, 'rental')), ...props.sales.map((s) => toRow(s, 'sale'))]
  return all.sort((a, b) => Number(a.disponibilidad === 'reservado') - Number(b.disponibilidad === 'reservado'))
})

const hayAlquileres = computed(() => props.rentals.length > 0)
const hayVentas = computed(() => props.sales.length > 0)
// Las pills de operación sólo tienen sentido si el link trae de las dos.
const mostrarOperacion = computed(() => hayAlquileres.value && hayVentas.value)

// Mismo catálogo de amenities y mismos rangos de precio que los catálogos
// públicos (departamentos/index.vue y ventas/index.vue).
const AMENITY_LABELS: Record<string, string> = {
  pileta: '🏊 Pileta',
  gimnasio: '🏋️ Gimnasio',
  laundry: '🫧 Laundry',
  parrilla: '🔥 Parrilla',
  terraza: '🌿 Terraza',
  cochera: '🚗 Cochera',
  sauna: '♨️ Sauna',
  solárium: '☀️ Solárium',
  'seguridad 24hs': '🔒 Seguridad 24hs',
  jacuzzi: '🛁 Jacuzzi',
}
const AMENITY_FILTERS = Object.keys(AMENITY_LABELS)

const TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH']
const TIPO_LABELS: Record<string, string> = {
  monoambiente: 'Mono',
  '2 ambientes': '2 amb.',
  '3 ambientes': '3 amb.',
  '4+ ambientes': '4+',
  casa: 'Casa',
  PH: 'PH',
}
// Los tipos salen de lo que trae el link, no de la lista fija: un catálogo de
// tres propiedades no tiene por qué ofrecer seis chips que no matchean nada.
const tipoOptions = computed(() => {
  const presentes = new Set(rows.value.map((r) => r.tipo).filter(Boolean))
  return [...TIPOS.filter((t) => presentes.has(t)), ...[...presentes].filter((t) => !TIPOS.includes(t)).sort()]
})

const ALQ_MIN = 500
const ALQ_MAX = 8000
const ALQ_STEP = 100
const VTA_MIN = 30000
const VTA_MAX = 500000
const VTA_STEP = 5000
const SUP_MAX = 300
const SUP_STEP = 5

function normalizarBarrio(b: string) {
  return b
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
const barrios = computed(() => [...new Set(rows.value.map((r) => normalizarBarrio(r.barrio)).filter(Boolean))].sort())

const search = ref('')
const operacion = ref<'' | Kind>('')
const barrio = ref('')
const tipos = ref<string[]>([])
// Un solo slider para los dos no sirve: 800 por mes y 180.000 de venta no
// entran en la misma escala. Son dos, cada uno aplicado sólo a lo suyo, y se
// muestra el que corresponde a la operación elegida.
const precioMaxAlquiler = ref(ALQ_MAX)
const precioMaxVenta = ref(VTA_MAX)
const superficieMin = ref(0)
const amueblado = ref<'' | 'si' | 'no'>('')
const mascotas = ref(false)
const aptoCredito = ref(false)
const soloDisponibles = ref(false)
const amenitiesSel = ref<string[]>([])

const verAlquileres = computed(() => operacion.value !== 'sale' && hayAlquileres.value)
const verVentas = computed(() => operacion.value !== 'rental' && hayVentas.value)

// Los filtros que son de una sola operación (mascotas, apto crédito,
// superficie) se esconden al cambiar de pestaña. Si quedaran prendidos sin
// control a la vista, el catálogo filtraría por algo que ya no se ve.
watch(operacion, () => {
  if (!verAlquileres.value) mascotas.value = false
  if (!verVentas.value) {
    aptoCredito.value = false
    superficieMin.value = 0
  }
})

function toggleIn(list: string[], v: string) {
  const i = list.indexOf(v)
  if (i === -1) list.push(v)
  else list.splice(i, 1)
}
function setAmueblado(v: 'si' | 'no') {
  amueblado.value = amueblado.value === v ? '' : v
}
function clearFilters() {
  search.value = ''
  operacion.value = ''
  barrio.value = ''
  tipos.value = []
  precioMaxAlquiler.value = ALQ_MAX
  precioMaxVenta.value = VTA_MAX
  superficieMin.value = 0
  amueblado.value = ''
  mascotas.value = false
  aptoCredito.value = false
  soloDisponibles.value = false
  amenitiesSel.value = []
}

const filtered = computed(() =>
  rows.value.filter((r) => {
    if (operacion.value && r.kind !== operacion.value) return false
    if (barrio.value && normalizarBarrio(r.barrio) !== barrio.value) return false
    if (tipos.value.length && !tipos.value.includes(r.tipo)) return false
    if (search.value.trim() && !r.haystack.includes(search.value.trim().toLowerCase())) return false
    // El tope de precio sólo corre sobre USD: un precio en pesos comparado
    // contra una escala en dólares deja afuera todo el catálogo en ARS.
    //
    // Y sólo filtra si el slider NO está en el máximo: si no, una propiedad
    // más cara que el tope de la escala no se podría ver nunca, ni siquiera
    // sin tocar ningún filtro.
    if (r.precio > 0 && r.moneda === 'USD') {
      const tope = r.kind === 'rental' ? precioMaxAlquiler.value : precioMaxVenta.value
      const max = r.kind === 'rental' ? ALQ_MAX : VTA_MAX
      if (tope < max && r.precio > tope) return false
    }
    if (superficieMin.value && r.kind === 'sale' && r.superficie < superficieMin.value) return false
    if (amueblado.value === 'si' && !r.amueblado) return false
    if (amueblado.value === 'no' && r.amueblado) return false
    if (mascotas.value && !r.mascotas) return false
    if (aptoCredito.value && !r.aptoCredito) return false
    if (soloDisponibles.value && r.disponibilidad !== 'disponible') return false
    if (amenitiesSel.value.length && !amenitiesSel.value.every((a) => r.amenities.includes(a))) return false
    return true
  }),
)

const activeFilterCount = computed(() => {
  let n = 0
  if (search.value.trim()) n++
  if (operacion.value) n++
  if (barrio.value) n++
  if (tipos.value.length) n++
  if (precioMaxAlquiler.value < ALQ_MAX) n++
  if (precioMaxVenta.value < VTA_MAX) n++
  if (superficieMin.value > 0) n++
  if (amueblado.value) n++
  if (mascotas.value) n++
  if (aptoCredito.value) n++
  if (soloDisponibles.value) n++
  if (amenitiesSel.value.length) n++
  return n
})

function precioLabel(r: Row) {
  return r.precio > 0 ? `${r.moneda} ${r.precio.toLocaleString('es-AR')}` : 'Consultar precio'
}

// ── Vista Lista / Mapa ────────────────────────────────
const catalogView = ref<'list' | 'map'>('list')

const mapPoints = computed(() =>
  filtered.value.flatMap((r) =>
    r.coords
      ? [{
          id: r.id,
          coords: r.coords,
          titulo: r.titulo,
          subtitulo: [r.barrio, r.tipo, r.kind === 'sale' ? 'Venta' : null].filter(Boolean).join(' · '),
          precio: precioLabel(r),
          imagen: r.imagen || undefined,
          href: r.href,
        }]
      : [],
  ),
)
// Las propiedades sin lat/lng ni link de Maps parseable no tienen pin (ver
// geo.ts). Si el visitante abre el mapa y ve menos tarjetas que en la lista,
// tiene que saber por qué.
const sinUbicar = computed(() => filtered.value.length - mapPoints.value.length)

const { open: panelOpen, toggle: togglePanel, close: closePanel } = useFilterPanel()
</script>

<template>
  <div class="br-brand-catalog-wrap">
    <div class="br-filtros-overlay" :class="{ open: panelOpen }" @click="closePanel"></div>

    <!-- `br-brand-filtros` reposiciona el sticky: la barra del catálogo público
         se pega a top:0, pero acá arriba ya está la barra del vendedor, que
         también es sticky. Ver br-brand.css. -->
    <div class="br-filtros-wrapper br-brand-filtros" :class="{ open: panelOpen }">
      <div class="br-filtros-bar">
        <div class="br-quick-search">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="search" type="search" placeholder="Título, barrio, descripción..." autocomplete="off" />
        </div>

        <select v-if="barrios.length > 1" v-model="barrio" class="br-quick-barrio">
          <option value="">Barrio</option>
          <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
        </select>

        <div v-if="mostrarOperacion" class="br-quick-tipos">
          <button type="button" class="br-pill-btn" :class="{ active: operacion === 'rental' }" @click="operacion = operacion === 'rental' ? '' : 'rental'">
            Alquiler
          </button>
          <button type="button" class="br-pill-btn" :class="{ active: operacion === 'sale' }" @click="operacion = operacion === 'sale' ? '' : 'sale'">
            Venta
          </button>
        </div>

        <button class="br-filtros-trigger" :class="{ active: panelOpen }" type="button" :aria-expanded="panelOpen" @click="togglePanel">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="10" y2="18" />
          </svg>
          Filtrar
          <span v-show="activeFilterCount > 0" class="br-filtro-badge">{{ activeFilterCount }}</span>
        </button>

        <div class="br-filtros-bar-end">
          <span class="br-contador-inline">{{ filtered.length }}/{{ rows.length }} props.</span>
          <button v-show="activeFilterCount > 0" type="button" class="br-btn-limpiar" @click="clearFilters">✕ Limpiar</button>
          <div class="br-catalogo-view-toggle">
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'list' }" @click="catalogView = 'list'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Lista
            </button>
            <button type="button" class="br-view-toggle-btn" :class="{ active: catalogView === 'map' }" @click="catalogView = 'map'">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              Mapa
            </button>
          </div>
        </div>
      </div>

      <div class="br-filtro-sheet-header">
        <button class="br-filtro-sheet-close-btn" type="button" aria-label="Cerrar filtros" @click="closePanel">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="br-filtro-sheet-title">Filtros</span>
        <button class="br-filtro-sheet-reset-btn" type="button" @click="clearFilters">✕ Limpiar</button>
      </div>

      <div class="br-filtros-panel">
        <div class="br-filtros-inner">
          <div class="br-filtros-collapsible">
            <div class="br-filtros-row">
              <div class="br-filtro-grupo br-busqueda-wrap br-filtro-grupo-dup">
                <span class="br-filtro-label">Buscar</span>
                <input v-model="search" type="search" class="br-filtro-search" placeholder="Título, barrio, descripción..." autocomplete="off" />
              </div>

              <div v-if="mostrarOperacion" class="br-filtro-grupo">
                <span class="br-filtro-label">Operación</span>
                <div class="br-filtro-pills">
                  <button type="button" class="br-pill-btn" :class="{ active: operacion === 'rental' }" @click="operacion = operacion === 'rental' ? '' : 'rental'">Alquiler</button>
                  <button type="button" class="br-pill-btn" :class="{ active: operacion === 'sale' }" @click="operacion = operacion === 'sale' ? '' : 'sale'">Venta</button>
                </div>
              </div>

              <div v-if="barrios.length > 1" class="br-filtro-grupo br-filtro-grupo-dup">
                <span class="br-filtro-label">Barrio</span>
                <select v-model="barrio" class="br-filtro-select">
                  <option value="">Todos</option>
                  <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>

              <div v-if="tipoOptions.length > 1" class="br-filtro-grupo br-filtro-grupo-dup">
                <span class="br-filtro-label">Tipo</span>
                <div class="br-filtro-pills">
                  <button
                    v-for="tp in tipoOptions"
                    :key="tp"
                    type="button"
                    class="br-pill-btn"
                    :class="{ active: tipos.includes(tp) }"
                    @click="toggleIn(tipos, tp)"
                  >
                    {{ TIPO_LABELS[tp] || tp }}
                  </button>
                </div>
              </div>

              <div v-if="verAlquileres" class="br-filtro-grupo br-precio-wrap">
                <div class="br-precio-top">
                  <span class="br-filtro-label">{{ mostrarOperacion ? 'Precio máx. alquiler' : 'Precio máx.' }}</span>
                  <span class="br-brand-precio-valor">USD {{ precioMaxAlquiler.toLocaleString('es-AR') }}</span>
                </div>
                <input v-model.number="precioMaxAlquiler" type="range" class="br-range" :min="ALQ_MIN" :max="ALQ_MAX" :step="ALQ_STEP" />
              </div>

              <div v-if="verVentas" class="br-filtro-grupo br-precio-wrap">
                <div class="br-precio-top">
                  <span class="br-filtro-label">{{ mostrarOperacion ? 'Precio máx. venta' : 'Precio máx.' }}</span>
                  <span class="br-brand-precio-valor">USD {{ precioMaxVenta.toLocaleString('es-AR') }}</span>
                </div>
                <input v-model.number="precioMaxVenta" type="range" class="br-range" :min="VTA_MIN" :max="VTA_MAX" :step="VTA_STEP" />
              </div>

              <div v-if="verVentas" class="br-filtro-grupo br-precio-wrap">
                <div class="br-precio-top">
                  <span class="br-filtro-label">Superficie mín.</span>
                  <span class="br-brand-precio-valor">{{ superficieMin > 0 ? `${superficieMin} m²` : 'Cualquiera' }}</span>
                </div>
                <input v-model.number="superficieMin" type="range" class="br-range" :min="0" :max="SUP_MAX" :step="SUP_STEP" />
              </div>

              <div class="br-filtro-grupo">
                <span class="br-filtro-label">Amueblado</span>
                <div class="br-filtro-pills">
                  <button type="button" class="br-pill-btn" :class="{ active: amueblado === 'si' }" @click="setAmueblado('si')">Sí</button>
                  <button type="button" class="br-pill-btn" :class="{ active: amueblado === 'no' }" @click="setAmueblado('no')">No</button>
                </div>
              </div>

              <div v-if="verAlquileres" class="br-filtro-grupo">
                <span class="br-filtro-label">Mascotas</span>
                <div class="br-filtro-pills">
                  <button type="button" class="br-pill-btn" :class="{ active: mascotas }" @click="mascotas = !mascotas">🐾 Acepta mascotas</button>
                </div>
              </div>

              <div v-if="verVentas" class="br-filtro-grupo">
                <span class="br-filtro-label">Financiación</span>
                <div class="br-filtro-pills">
                  <button type="button" class="br-pill-btn" :class="{ active: aptoCredito }" @click="aptoCredito = !aptoCredito">🏦 Apto crédito</button>
                </div>
              </div>

              <div class="br-filtro-grupo">
                <span class="br-filtro-label">Disponibilidad</span>
                <div class="br-filtro-pills">
                  <button type="button" class="br-pill-btn br-pill-btn-disponible" :class="{ active: soloDisponibles }" @click="soloDisponibles = !soloDisponibles">
                    ✓ Solo disponibles
                  </button>
                </div>
              </div>

              <div class="br-filtro-grupo">
                <div class="br-filtro-pills">
                  <label v-for="a in AMENITY_FILTERS" :key="a" class="br-amenity-check">
                    <input type="checkbox" :checked="amenitiesSel.includes(a)" @change="toggleIn(amenitiesSel, a)" />
                    <span>{{ AMENITY_LABELS[a] }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="br-filtro-sheet-footer">
          <button type="button" class="br-filtro-sheet-reset-btn br-reset-escritorio" @click="clearFilters">✕ Limpiar</button>
          <button type="button" class="br-filtro-sheet-apply-btn" @click="closePanel">Ver {{ filtered.length }} propiedades</button>
        </div>
      </div>
    </div>

    <main class="br-brand-catalog">
      <h1 class="br-brand-catalog-title">
        {{ filtered.length }} {{ filtered.length === 1 ? 'propiedad disponible' : 'propiedades disponibles' }}
      </h1>

      <div v-if="!rows.length" class="br-brand-empty">No hay propiedades disponibles en este momento.</div>

      <div v-else class="br-catalogo-split">
        <div class="br-catalogo-list" :class="{ 'br-lista-oculta': catalogView === 'map' }">
          <div v-if="!filtered.length" class="br-brand-empty">
            <p>Ninguna propiedad coincide con estos filtros.</p>
            <button type="button" class="br-btn-limpiar" @click="clearFilters">✕ Limpiar filtros</button>
          </div>

          <div v-else class="br-brand-grid">
            <NuxtLink v-for="p in filtered" :key="`${p.kind}-${p.id}`" :to="p.href" class="br-brand-card">
              <div class="br-brand-card-img">
                <img v-if="p.imagen" :src="p.imagen" :alt="p.titulo" loading="lazy" />
                <span v-else>📷</span>
                <div class="br-brand-card-tags">
                  <span v-if="p.kind === 'sale'" class="br-brand-tag br-brand-tag-venta">Venta</span>
                  <span v-if="p.disponibilidad === 'reservado'" class="br-brand-tag br-brand-tag-reservado">Reservado</span>
                </div>
              </div>
              <div class="br-brand-card-body">
                <span class="br-brand-card-loc">{{ [p.barrio, p.tipo].filter(Boolean).join(' · ') }}</span>
                <strong class="br-brand-card-title">{{ p.titulo }}</strong>
                <span class="br-brand-card-price">{{ precioLabel(p) }}</span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <div class="br-catalogo-map-panel br-brand-map-panel" :class="{ 'br-mapa-oculto': catalogView === 'list' }">
          <ClientOnly>
            <CatalogMap v-if="catalogView === 'map'" :points="mapPoints" ver-detalles="Ver detalles" />
          </ClientOnly>
        </div>
      </div>

      <p v-if="catalogView === 'map' && sinUbicar > 0" class="br-brand-map-note">
        {{ sinUbicar === 1 ? '1 propiedad no tiene ubicación cargada y no aparece en el mapa.' : `${sinUbicar} propiedades no tienen ubicación cargada y no aparecen en el mapa.` }}
      </p>
    </main>
  </div>
</template>
