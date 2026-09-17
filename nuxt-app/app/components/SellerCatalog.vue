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
  sellerWhatsapp?: string | null
}>()

const router = useRouter()
function goTo(p: { href: string }) {
  router.push(p.href)
}

// Mismo dominio que usan departamentos/index.vue y ventas/index.vue para
// armar el link absoluto del mensaje de WhatsApp — hace falta que sea
// absoluto y fijo (no window.location.origin) porque este link se renderiza
// también en el servidor.
const SITE_URL = 'https://www.bairesrental.com.ar'

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
  direccion: string
  direccionUrl: string
  esPropio: boolean
  /** Sólo alquileres: null en ventas, para no dibujar el tag. */
  serviciosIncluidos: boolean | null
  /** Sólo alquileres con mínimo > 1 mes: 0 en ventas, para no dibujar el tag. */
  minimoMeses: number
  /** Sólo ventas: 0 en alquileres. */
  ambientes: number
  /** Sólo ventas: 0 en alquileres o si no hay más de 1 foto. */
  fotosCount: number
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
    direccion: r.direccion || '',
    direccionUrl: r.direccionUrl || '',
    esPropio: !!r.esPropio,
    serviciosIncluidos: kind === 'rental' ? !!r.serviciosIncluidos : null,
    minimoMeses: kind === 'rental' && Number(r.minimoMeses) > 1 ? Number(r.minimoMeses) : 0,
    ambientes: kind === 'sale' ? Number(r.ambientes) || 0 : 0,
    fotosCount: kind === 'sale' && Array.isArray(r.fotos) ? r.fotos.length : 0,
  }
}

function waMessageFor(p: Row) {
  const link = `${SITE_URL}${p.href}`
  return `Hola! Me interesa "${p.titulo}"${p.barrio ? ` en ${p.barrio}` : ''}.\n\n${link}`
}

// El orden que trae el payload ya pone primero lo de BairesRental y después
// lo del vendedor (catalogOrder en server/api/l/[code].get.ts), igual que el
// catálogo público. Lo único que se reordena acá es mandar las reservadas al
// final: siguen estando —el cliente puede preguntar igual— pero no arriba de
// todo. El sort de JS es estable, así que dentro de cada grupo se conserva el
// orden del servidor.
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
function amenityLabel(a: string) {
  return AMENITY_LABELS[a] || `✦ ${a}`
}

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

// Compartir UNA propiedad puntual del catálogo — share nativo si el
// navegador lo tiene (celular), si no copia el link. Distinto del "Compartir
// con mi marca" del panel del vendedor: esto es para que el visitante de
// esta página le reenvíe una propiedad a alguien, no genera un link
// rastreable nuevo.
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}
async function onShare(r: Row) {
  const url = `${window.location.origin}${r.href}`
  if (navigator.share) {
    try {
      await navigator.share({ title: `${r.titulo} — BairesRental`, url })
    } catch {
      // el visitante cerró la hoja de compartir nativa — no hay nada que hacer
    }
  } else {
    await navigator.clipboard.writeText(url)
    showToast('Link copiado al portapapeles ✓')
  }
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

        <!-- Operación y tipo van en la barra, no sólo adentro del panel: los
             grupos de abajo llevan `br-filtro-grupo-dup`, que en escritorio
             los esconde justamente porque se asume que ya están acá. -->
        <div v-if="mostrarOperacion || tipoOptions.length > 1" class="br-quick-tipos">
          <template v-if="mostrarOperacion">
            <button type="button" class="br-pill-btn" :class="{ active: operacion === 'rental' }" @click="operacion = operacion === 'rental' ? '' : 'rental'">
              Alquiler
            </button>
            <button type="button" class="br-pill-btn" :class="{ active: operacion === 'sale' }" @click="operacion = operacion === 'sale' ? '' : 'sale'">
              Venta
            </button>
            <span v-if="tipoOptions.length > 1" class="br-quick-sep" aria-hidden="true"></span>
          </template>
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

              <div v-if="mostrarOperacion" class="br-filtro-grupo br-filtro-grupo-dup">
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
            <div v-for="p in filtered" :key="`${p.kind}-${p.id}`" class="br-prop-card">
              <div class="br-prop-img" @click="goTo(p)">
                <img v-if="p.imagen" :src="p.imagen" :alt="p.titulo" loading="lazy" />
                <div v-else class="br-prop-img-placeholder">📸</div>
                <div class="br-prop-badges">
                  <span v-if="p.esPropio" class="br-badge br-badge-propio">★ BairesRental</span>
                  <span v-if="p.fotosCount > 1" class="br-badge br-fotos-count">📷 {{ p.fotosCount }}</span>
                </div>
                <div class="br-prop-badges-right">
                  <span
                    class="br-badge"
                    :class="p.disponibilidad === 'reservado' ? 'br-badge-reservado' : 'br-badge-disponible'"
                  >
                    {{ p.disponibilidad === 'reservado' ? '● Reservado' : '● Disponible' }}
                  </span>
                </div>
              </div>
              <div class="br-prop-body">
                <div class="br-prop-clickzone" @click="goTo(p)">
                  <div class="br-prop-location">
                    {{ [p.barrio, p.tipo, p.kind === 'sale' ? 'Venta' : null].filter(Boolean).join(' · ') }}
                  </div>
                  <div v-if="p.direccion && p.direccionUrl" class="br-prop-direccion">
                    <a :href="p.direccionUrl" target="_blank" rel="noopener" class="br-btn-ver-mapa" @click.stop>
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                      </svg>
                      {{ p.direccion }} — Ver mapa
                    </a>
                  </div>
                  <h2 class="br-prop-titulo">{{ p.titulo }}</h2>
                  <div class="br-prop-precio-row">
                    <span class="br-precio">{{ precioLabel(p) }}</span>
                    <span v-if="p.kind === 'rental' && p.precio > 0" class="br-precio-sub">
                      /mes
                      <span :class="p.serviciosIncluidos ? 'br-tag-servicios' : 'br-tag-servicios-aparte'">
                        {{ p.serviciosIncluidos ? 'Paquete completo' : 'Servicios aparte' }}
                      </span>
                      <span v-if="p.minimoMeses > 0" class="br-tag-minimo">
                        Mínimo {{ p.minimoMeses }} {{ p.minimoMeses === 1 ? 'mes' : 'meses' }}
                      </span>
                    </span>
                    <span v-if="p.kind === 'sale'" class="br-precio-sub">
                      <span v-if="p.superficie" class="br-tag-servicios">{{ p.superficie }} m²</span>
                      <span v-if="p.ambientes" class="br-tag-minimo">{{ p.ambientes }} amb.</span>
                      <span v-if="p.aptoCredito" class="br-tag-servicios">🏦 Apto crédito</span>
                    </span>
                  </div>
                  <div class="br-amenities-row">
                    <span v-if="p.mascotas" class="br-amenity-tag">🐾 Acepta mascotas</span>
                    <span v-for="a in p.amenities.slice(0, 4)" :key="a" class="br-amenity-tag">{{ amenityLabel(a) }}</span>
                  </div>
                </div>
                <div class="br-prop-actions">
                  <div class="br-btn-detalle-row">
                    <a
                      :href="whatsappUrl(waMessageFor(p), sellerWhatsapp)"
                      target="_blank"
                      rel="noopener"
                      class="br-btn-wa-outline"
                      @click.stop
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
                        <path
                          d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
                        />
                      </svg>
                      Consultar por WhatsApp
                    </a>
                    <button
                      type="button"
                      class="br-btn-compartir"
                      :aria-label="`Compartir ${p.titulo}`"
                      title="Compartir"
                      @click.stop="onShare(p)"
                    >
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

    <div class="br-brand-toast" v-show="toast">{{ toast }}</div>
  </div>
</template>
