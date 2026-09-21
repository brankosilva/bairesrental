import { computed, ref, type Ref } from 'vue'
import { AVAILABILITY_OPTIONS, type Availability, type PropertyKind } from '~/utils/availability'

// Filtros de las listas del panel, compartidos por admin/rentals y admin/sales:
// tipo, gestión (propia de BairesRental o de terceros) y disponibilidad, encima
// del buscador de texto que ya estaba. Con ~80 alquileres el buscador solo no
// alcanza para las preguntas de todos los días ("¿qué monoambientes propios
// tengo libres?"): obliga a acordarse del título o del barrio, que es
// justamente lo que no se sabe todavía.
//
// LOS TIPOS SALEN DE LOS DATOS, no de una constante como la del catálogo
// público (departamentos/index.vue:59). Allá la lista fija está bien: el
// visitante filtra sobre lo publicado y una propiedad con un `tipo` fuera de la
// lista simplemente no es alcanzable por ese filtro. Acá es al revés — el panel
// es el único lugar donde esos documentos raros se tienen que poder ver y
// arreglar — así que las opciones se derivan de lo cargado: en el orden
// canónico los que existen, y al final los valores fuera de él. De paso nunca
// se ofrece un chip que no matchee nada.
const TIPOS_CANONICOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH']

export type PropioFilter = '' | 'si' | 'no'

// View-model angosto, mismo criterio que PropertyAdminCard: lo único que estos
// filtros necesitan de una propiedad, sin atarse a RentalProperty | SaleProperty.
export interface FilterableProperty {
  id: string
  titulo: string
  barrio: string
  direccion?: string
  tipo: string
  disponibilidad: Availability
  esPropio?: boolean
}

export function usePropertyFilters<T extends FilterableProperty>(kind: PropertyKind, rows: Ref<T[]>) {
  const search = ref('')
  const tipos = ref<string[]>([])
  const disponibilidad = ref('')
  const propio = ref<PropioFilter>('')

  // Las de disponibilidad sí son fijas: son tres por tipo de propiedad y el
  // valor terminal cambia (alquileres "no disponible", ventas "vendido").
  const availabilityOptions = AVAILABILITY_OPTIONS[kind]

  const tipoOptions = computed(() => {
    const presentes = new Set(rows.value.map((r) => r.tipo).filter(Boolean))
    const canonicos = TIPOS_CANONICOS.filter((t) => presentes.has(t))
    const resto = [...presentes].filter((t) => !TIPOS_CANONICOS.includes(t)).sort()
    return [...canonicos, ...resto]
  })

  function matches(p: T): boolean {
    const q = search.value.trim().toLowerCase()
    if (q && !`${p.titulo} ${p.barrio} ${p.direccion ?? ''} ${p.id}`.toLowerCase().includes(q)) return false
    if (tipos.value.length && !tipos.value.includes(p.tipo)) return false
    if (disponibilidad.value && p.disponibilidad !== disponibilidad.value) return false
    if (propio.value === 'si' && !p.esPropio) return false
    if (propio.value === 'no' && p.esPropio) return false
    return true
  }

  const activeCount = computed(() => {
    let n = 0
    if (search.value.trim()) n++
    if (tipos.value.length) n++
    if (disponibilidad.value) n++
    if (propio.value) n++
    return n
  })

  function clear() {
    search.value = ''
    tipos.value = []
    disponibilidad.value = ''
    propio.value = ''
  }

  return { search, tipos, disponibilidad, propio, tipoOptions, availabilityOptions, matches, activeCount, clear }
}
