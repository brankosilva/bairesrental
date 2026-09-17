// Lee una ficha pública de ficha.info (el "link para colegas" de Tokko Broker)
// y la convierte a una propiedad del catálogo: `fichaToRental()` para alquiler
// temporario, `fichaToSale()` para venta. El parseo del HTML es el mismo; lo que
// cambia es de dónde sale el precio y qué campos mira cada catálogo.
//
// ficha.info es una app Next.js que trae el JSON completo de la propiedad
// embebido en el HTML, repartido en chunks `self.__next_f.push([1,"..."])`.
// Reconstruyendo esos chunks se recupera el mismo objeto que devuelve la API de
// Tokko, así que una URL de ficha alcanza para cargar una propiedad entera.
//
// ─────────────────────────────────────────────────────────────────────────────
// OJO: este archivo es el gemelo TypeScript de scripts/lib/ficha.js +
// scripts/add-from-ficha.js. Hay dos copias porque functions/ es un paquete
// aparte que no puede importar de scripts/ (se despliega solo con su propio
// directorio), igual que pasa con isShareableBySeller. Si tocás una, tocá la
// otra: el mapeo tiene que dar lo mismo desde el panel que desde la terminal.
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 15000

// Nombre de la inmobiliaria/cuenta Tokko bajo la que se publican las fichas.
const MI_INMOBILIARIA_TOKKO = 'GO NEGOCIOS INMOBILIARIOS'

// Las URLs que se comparten vienen con un cache-buster (`?v=1789509778773`) que
// no aporta nada y ensucia el campo `fotos`. La forma canónica es sin querystring.
const FICHA_URL_RE = /^https?:\/\/(?:www\.)?ficha\.info\/p\/([0-9a-f]{8,64})(?:[/?#]|$)/i

export interface FichaProperty {
  id?: number
  address?: string
  location?: string
  description?: string
  basic_info?: { key?: string; name?: string; value?: unknown }[]
  additionals?: string[]
  /** La clave real de Tokko es en singular; `additionals` quedó del mapeo viejo. */
  additional?: string[]
  rooms?: string[]
  services?: string[]
  tags?: { name?: string }[]
  type?: { name?: string }
  status?: { name?: string }
  active?: boolean
  created_at?: string
  geolocation?: { lat?: string; lng?: string }
  temporary?: { periods?: [string, string][] }
  /** `{ Sale: ["USD 120.000"], Rent: ["USD 990"], Temporary: [...] }`. */
  operations?: Record<string, string[]>
  /** `[{ key: 'total_surface', value: '62 m²', original_value: 62 }]`. */
  measurement?: { key?: string; name?: string; value?: string; original_value?: number }[]
  /** Donde Tokko mete las expensas: `[{ name: 'Expensas', value: '172.000' }]`. */
  operation_block_data?: { name?: string; value?: string }[]
  pictures?: { front_cover_image?: { url?: string }; images?: string[] }
  company?: { name?: string }
}

export interface Ficha {
  property?: FichaProperty
  edited_ficha?: {
    url?: string
    description?: string
    created_at?: string
    // La selección de fotos de la ficha. Viene vacía si nadie la editó, y ahí
    // valen las de `property`.
    pictures?: { front_cover_image?: { url?: string } | null; images?: string[] }
  }
  branch?: { name?: string; company?: { name?: string } }
  operation_can_edit?: boolean
}

// Los campos que el formulario de /app/rentals/new sabe llenar. No incluye `id`:
// ese lo sugiere el callable aparte, mirando el catálogo.
/**
 * De qué link salió la propiedad. Se guarda en el documento para poder volver a
 * leer la ficha y refrescar precio y disponibilidad más adelante.
 *
 * No alcanza con `fotos`: en alquileres guarda la misma URL pero es un campo
 * editable (puede terminar apuntando a un álbum de Google Photos), y en venta
 * `fotos` son las fotos de verdad, así que el link no quedaba en ningún lado.
 *
 * Gemelo de lo que escribe scripts/add-from-ficha.js y de `OrigenImport` en
 * app/types/property.ts.
 */
export interface OrigenImport {
  /** Qué ficha: 'ficha.info' (Tokko) o 'fichaprop.tech' (Tencery). */
  fuente: string
  /** La URL canónica, sin el cache-buster. */
  url: string
  /** Cuándo se leyó la ficha por última vez, en ISO. */
  leidoEn: string
}

export interface RentalFields {
  titulo: string
  barrio: string
  tipo: string
  precio: number
  moneda: 'USD' | 'ARS'
  disponibilidad: 'disponible' | 'reservado' | 'no disponible'
  disponibleDesde: string
  amueblado: boolean
  mascotas: boolean
  serviciosIncluidos: boolean
  minimoMeses: number
  amenities: string[]
  descripcion: string
  imagen: string
  fotos: string
  fichaUrl: string
  direccion: string
  direccionUrl: string
  lat?: number
  lng?: number
  whatsappMsg: string
  esPropio: boolean
  /** Lo completa el callable, que es el que sabe de qué URL salió el pedido. */
  origen?: OrigenImport
}

// ─── URL ─────────────────────────────────────────────────────────────────────

export function esUrlDeFicha(url: string): boolean {
  return FICHA_URL_RE.test((url || '').trim())
}

export function urlCanonica(url: string): string {
  const m = (url || '').trim().match(FICHA_URL_RE)
  if (!m) throw new Error(`No parece una URL de ficha.info: "${url}"`)
  return `https://ficha.info/p/${m[1].toLowerCase()}`
}

// ─── Parseo del payload de Next.js ───────────────────────────────────────────

// Extrae el objeto JSON que arranca en `str[inicio]` balanceando llaves. Hay que
// ignorar las que caen adentro de strings: las descripciones de Tokko vienen con
// HTML y comillas escapadas.
function objetoDesde(str: string, inicio: number): Record<string, unknown> | null {
  let nivel = 0
  let enString = false
  let escapado = false

  for (let i = inicio; i < str.length; i++) {
    const c = str[i]
    if (escapado) { escapado = false; continue }
    if (c === '\\') { escapado = true; continue }
    if (c === '"') { enString = !enString; continue }
    if (enString) continue
    if (c === '{') nivel++
    else if (c === '}') {
      nivel--
      if (nivel === 0) return JSON.parse(str.slice(inicio, i + 1))
    }
  }
  return null
}

function payloadDeNext(html: string): string {
  const chunks = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  let texto = ''
  let m: RegExpExecArray | null
  while ((m = chunks.exec(html)) !== null) texto += JSON.parse(m[1])
  return texto
}

// Tira error si no encuentra los datos, en vez de devolver campos vacíos que
// después se guardarían como una propiedad a medias.
export function parseFicha(html: string): Ficha {
  const payload = payloadDeNext(html)
  if (!payload) {
    throw new Error('La ficha no trae el payload de Next.js (¿cambió el formato de ficha.info?)')
  }

  for (const marca of ['{"public_view":', '{"show_contact":']) {
    const i = payload.indexOf(marca)
    if (i >= 0) {
      const obj = objetoDesde(payload, i) as Ficha | null
      if (obj && obj.property) return obj
    }
  }

  const iProp = payload.indexOf('"property":{')
  if (iProp >= 0) {
    const property = objetoDesde(payload, payload.indexOf('{', iProp + '"property":'.length - 1))
    if (property) return { property: property as FichaProperty }
  }

  throw new Error('No encontré los datos de la propiedad en la ficha (¿cambió el formato de ficha.info, o la ficha no existe?)')
}

export async function fetchFicha(url: string): Promise<Ficha> {
  const resp = await fetch(urlCanonica(url), {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (BairesRental catalog importer)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} al pedir la ficha`)
  return parseFicha(await resp.text())
}

// ─── Mapeo a RentalProperty ──────────────────────────────────────────────────

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim()
}

function capitalize(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

// Tokko escribe los precios como texto ya formateado: "USD 990", "USD 120.000",
// "ARS 1.250.000". El punto es separador de miles, así que hay que sacarlo antes
// de parsear — un parseFloat directo sobre "USD 120.000" devuelve 120.
function parsePrecio(texto: string): { precio: number; moneda: 'USD' | 'ARS' } | null {
  const m = (texto || '').match(/(USD|ARS|U\$S|\$)\s*([\d.,]+)/i)
  if (!m) return null
  const precio = parseFloat(m[2].replace(/[.,]/g, ''))
  if (!Number.isFinite(precio)) return null
  return { precio, moneda: /ars|^\$$/i.test(m[1]) ? 'ARS' : 'USD' }
}

function mapTipo(basicInfo: FichaProperty['basic_info'], propertyType?: { name?: string }): string {
  if (/casa|house|chalet|quinta/i.test(propertyType?.name || '')) return 'casa'
  const rooms = Number((basicInfo || []).find(b => b.key === 'room_amount')?.value)
  if (rooms >= 4) return '4+ ambientes'
  if (rooms === 3) return '3 ambientes'
  if (rooms === 2) return '2 ambientes'
  return 'monoambiente'
}

const AMENITIES_MAP: Record<string, string> = {
  'pileta': 'pileta', 'piscina': 'pileta',
  'gimnasio': 'gimnasio', 'gym': 'gimnasio',
  'laundry': 'laundry', 'lavanderia': 'laundry', 'lavandería': 'laundry',
  'parrilla': 'parrilla', 'quincho': 'parrilla', 'barbacoa': 'parrilla',
  'terraza': 'terraza', 'rooftop': 'terraza',
  'cochera': 'cochera', 'garaje': 'cochera', 'garage': 'cochera', 'estacionamiento': 'cochera',
  'sauna': 'sauna',
  'solarium': 'solárium', 'solárium': 'solárium', 'solário': 'solárium',
  'seguridad 24hs': 'seguridad 24hs', 'seguridad 24 hs': 'seguridad 24hs',
  'vigilancia 24hs': 'seguridad 24hs', 'portería': 'seguridad 24hs', 'porteria': 'seguridad 24hs',
  'jacuzzi': 'jacuzzi', 'jacuzzy': 'jacuzzi',
  'lavarropas': 'lavarropas',
}

// Tokko no usa un booleano simple: el campo "status" puede venir como
// "Disponible", "No disponible", "Tasación", "Alquilada", etc. Cualquier
// valor que no sea exactamente "disponible" cuenta como NO disponible.
// OJO: no uses /disponible/i.test(status) para esto — "No disponible"
// también matchea esa regex por contener la palabra "disponible", lo que
// hace que el chequeo nunca detecte una ficha caída. Ya pasó antes.
export function esDisponibleSegunTokko(status?: string | null): boolean | null {
  if (!status) return null
  return /^disponible$/i.test(status.trim())
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function aIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Sin año explícito se toma la primera vez que cae esa fecha a partir de cuándo
// se publicó la ficha, no a partir de hoy: una ficha de agosto que dice
// "disponible desde el 01 de septiembre" habla del septiembre siguiente a su
// publicación, aunque la estemos leyendo un año después.
function anioProbable(mes: number, dia: number, ref: Date): number {
  const anio = ref.getFullYear()
  return new Date(anio, mes - 1, dia) < new Date(anio, ref.getMonth(), ref.getDate()) ? anio + 1 : anio
}

function fechaDePublicacion(ficha: Ficha): Date {
  const iso = ficha.edited_ficha?.created_at
  if (iso) {
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return d
  }
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ficha.property?.created_at || '')
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return new Date()
}

export function extraerDisponibleDesde(texto: string, ref: Date): string {
  const desde = '(?:desde|a\\s+partir\\s+del?)\\s+(?:el\\s+)?'

  const textual = new RegExp(`disponible\\s+${desde}(\\d{1,2})\\s+de\\s+([a-záéíóúñ]+)(?:\\s+(?:de[l]?\\s+)?(\\d{4}))?`, 'i')
  let m = texto.match(textual)
  if (m) {
    const mes = MESES.indexOf(m[2].toLowerCase()) + 1
    const dia = parseInt(m[1], 10)
    if (mes > 0) return aIso(m[3] ? parseInt(m[3], 10) : anioProbable(mes, dia, ref), mes, dia)
  }

  const numerica = new RegExp(`disponible\\s+${desde}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?`, 'i')
  m = texto.match(numerica)
  if (m) {
    const dia = parseInt(m[1], 10)
    const mes = parseInt(m[2], 10)
    if (mes >= 1 && mes <= 12) {
      let anio = m[3] ? parseInt(m[3], 10) : anioProbable(mes, dia, ref)
      if (anio < 100) anio += 2000
      return aIso(anio, mes, dia)
    }
  }

  return ''
}

export function fichaToRental(ficha: Ficha): { prop: RentalFields; avisos: string[] } {
  const property = ficha.property || {}
  const avisos: string[] = []

  const direccion = (property.address || '').trim()
  const barrio = (property.location || '').split('|')[0].trim()
  const tipo = mapTipo(property.basic_info, property.type)

  // Precio: las fichas de alquiler temporario lo traen como ["Por mes", "USD 550"]
  const periodo = (property.temporary?.periods || [])[0]
  const { precio, moneda } = parsePrecio(periodo?.[1] || '') || { precio: 0, moneda: 'USD' as const }

  // `edited_ficha.description` es el mismo texto ya en plano; el `description`
  // de `property` viene en HTML y al limpiarlo quedan espacios colgando.
  const descripcion = (ficha.edited_ficha?.description || '').trim() || stripHtml(property.description || '')
  const titulo = `${capitalize(tipo)} en ${barrio}`
  const texto = `${descripcion}\n${titulo}`
  const textoLower = texto.toLowerCase()

  // Amenities: las fichas vienen sin tags/additionals, así que sale todo de la
  // descripción.
  const amenities: string[] = []
  for (const [palabra, mapeado] of Object.entries(AMENITIES_MAP)) {
    if (!amenities.includes(mapeado) && textoLower.includes(palabra)) amenities.push(mapeado)
  }

  const minimoMatch =
    texto.match(/plazo\s*m[ií]nimo[^:]*:\s*(\d+)\s*mes/i) ||
    texto.match(/estad[ií]a\s*m[ií]nima[^:]*:\s*(\d+)\s*mes/i) ||
    texto.match(/m[ií]nimo[:\s]+(\d+)\s*mes/i) ||
    texto.match(/(\d+)\s*mes(?:es)?\s*m[ií]nimo/i)
  const minimoMeses = minimoMatch ? parseInt(minimoMatch[1], 10) : 1

  const lat = parseFloat(property.geolocation?.lat || '')
  const lng = parseFloat(property.geolocation?.lng || '')
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng)

  const status = property.status?.name
  const disponibleEnTokko = esDisponibleSegunTokko(status)

  let serviciosIncluidos = false
  if (/servicios?\s+inclu|expensas\s+y\s+servicios|incluye\s+(?:luz|wifi)/i.test(texto)) {
    serviciosIncluidos = true
  } else if (!/servicios?\s+a\s+cargo\s+del\s+inquilino/i.test(texto)) {
    avisos.push('serviciosIncluidos: la ficha no aclara si incluye luz + wifi')
  }

  const prop: RentalFields = {
    titulo,
    barrio,
    tipo,
    precio,
    moneda,
    disponibilidad: disponibleEnTokko === false ? 'no disponible' : 'disponible',
    disponibleDesde: extraerDisponibleDesde(texto, fechaDePublicacion(ficha)),
    amueblado: /amoblad|amueblad|equipad/i.test(texto),
    mascotas: /mascota/i.test(texto) && !/(no\s+se\s+aceptan?|sin|no\s+admite)[^\n.]*mascota/i.test(texto),
    serviciosIncluidos,
    minimoMeses,
    amenities,
    descripcion,
    imagen: property.pictures?.front_cover_image?.url || (property.pictures?.images || [])[0] || '',
    // La ficha es justamente el álbum para colegas: va en `fotos`. `fichaUrl`
    // queda vacío, que es solo para links directos de Airbnb/Booking.
    fotos: ficha.edited_ficha?.url ? urlCanonica(ficha.edited_ficha.url) : '',
    fichaUrl: '',
    direccion,
    direccionUrl: tieneCoords ? `https://www.google.com/maps?q=${lat},${lng}` : '',
    whatsappMsg: `Hola! Me interesa el ${tipo} en ${barrio} (${direccion}). ¿Podría darme más información?`,
    // `esPropio` no se deduce: una ficha publicada bajo la cuenta propia de
    // Tokko no necesariamente es una propiedad propia de BairesRental.
    esPropio: false,
  }
  if (tieneCoords) {
    prop.lat = lat
    prop.lng = lng
  }

  if (disponibleEnTokko === false) avisos.push(`Tokko marca esta ficha como "${status}" → quedó "no disponible"`)
  if (prop.disponibleDesde) avisos.push(`disponibleDesde: ${prop.disponibleDesde} — deducido del texto, confirmá el año`)
  if (!/mascota/i.test(texto)) avisos.push('mascotas: la ficha no dice nada, confirmalo con el propietario')
  if (minimoMeses === 1 && !/m[ií]nim/i.test(texto)) avisos.push('minimoMeses: quedó en 1 porque la ficha no aclara el plazo')

  const company = property.company?.name || ficha.branch?.company?.name
  if (company && company.toLowerCase().includes(MI_INMOBILIARIA_TOKKO.toLowerCase())) {
    avisos.push(`la ficha está publicada bajo "${company}" — marcá "es propio" si la propiedad es de BairesRental`)
  } else if (company) {
    avisos.push(`OJO: la ficha aparece bajo otra inmobiliaria ("${company}")`)
  }

  if (!prop.imagen) avisos.push('la ficha no trae foto de portada — subí una desde el formulario')
  else avisos.push('la foto es una URL del CDN de Tokko: se cae si dan de baja el listado')

  return { prop, avisos }
}

// El catálogo numera estas propiedades como `alq-NN`. Los números en uso salen
// de los docs cuyo id es exactamente `alq-<dígitos>`; los históricos sucios
// (`alq-8315-`, `alq-PEDRO6767`, `alq-marie-11`) no matchean y quedan afuera.
// Se rellenan los huecos: si están el 01..05 y el 07, el próximo es el 06.
export function proximoIdAlq(ids: string[]): string {
  return proximoIdDeSerie(ids, 'alq')
}

// Las series del catálogo: `alq-NN` para los alquileres que entran por una
// ficha de ficha.info, `tenc-NN` para los de fichaprop.tech (Tencery) y
// `ven-NN` para las ventas. Se rellena el primer número libre, así que con
// alq-01..05 y alq-07 tomados el próximo es alq-06. Los ids históricos sucios
// (`alq-8315-`, `alq-PEDRO6767`) no matchean y quedan afuera del conteo.
export function proximoIdDeSerie(ids: string[], serie: string): string {
  const re = new RegExp(`^${serie}-(\\d+)$`)
  const usados = new Set<number>()
  for (const id of ids) {
    const m = re.exec(id || '')
    if (m) usados.add(parseInt(m[1], 10))
  }
  let n = 1
  while (usados.has(n)) n++
  return `${serie}-${String(n).padStart(2, '0')}`
}

// ─── Mapeo a SaleProperty ────────────────────────────────────────────────────

// Los campos que el formulario de /app/sales/new sabe llenar. Es el gemelo de
// RentalFields, con lo que cambia entre alquilar y vender: sale el plazo mínimo
// y las mascotas, entran los metros, los ambientes, las expensas y el crédito.
export interface SaleFields {
  titulo: string
  barrio: string
  tipo: string
  precio: number
  moneda: 'USD' | 'ARS'
  disponibilidad: 'disponible' | 'reservado' | 'vendido'
  superficie: number
  superficieCubierta?: number
  ambientes?: number
  banios?: number
  antiguedad: string
  expensas?: number
  aptoCredito: boolean
  amueblado: boolean
  amenities: string[]
  descripcion: string
  // Las fotos como las publica Tokko, todavía en su CDN. El formulario las pasa
  // por `importListingImage` al guardar, así la galería termina apuntando a
  // nuestro Storage: son hasta 20 fotos que no pueden depender de un CDN ajeno.
  fotos: string[]
  direccion: string
  direccionUrl: string
  lat?: number
  lng?: number
  whatsappMsg: string
  fichaUrl: string
  esPropio: boolean
  /** Lo completa el callable, que es el que sabe de qué URL salió el pedido. */
  origen?: OrigenImport
}

function basico(property: FichaProperty, key: string): unknown {
  return (property.basic_info || []).find(b => b.key === key)?.value
}

// Los números de `basic_info` vienen como number, pero no siempre: cuando Tokko
// no tiene el dato manda el texto "No especificado".
function numeroBasico(property: FichaProperty, key: string): number | undefined {
  const n = Number(basico(property, key))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

// `measurement` trae `original_value` numérico; si faltara, la superficie está
// igual adentro de `value` ("62 m²").
function medida(property: FichaProperty, key: string): number | undefined {
  const m = (property.measurement || []).find(x => x.key === key)
  if (!m) return undefined
  if (Number.isFinite(m.original_value) && (m.original_value as number) > 0) return m.original_value
  const n = parseFloat(String(m.value || '').replace(/[.,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function mapTipoVenta(property: FichaProperty): string {
  const nombre = property.type?.name || ''
  // PH sólo existe en el catálogo de ventas, así que se mira antes que nada:
  // un PH de 3 ambientes tiene que quedar "PH" y no "3 ambientes".
  if (/^ph\b|propiedad horizontal/i.test(nombre)) return 'PH'
  return mapTipo(property.basic_info, property.type)
}

// Los amenities de una ficha salen de tres listas distintas de Tokko
// (`additional`, `rooms`, `services`) más la descripción. Se busca por
// substring y no por igualdad: Tokko escribe "Seguridad portería" o "Pileta
// climatizada", que con una comparación exacta no matchean nunca.
function detectarAmenities(items: string[], texto: string): string[] {
  const fuentes = [...items.map(s => (s || '').toLowerCase()), texto.toLowerCase()]
  const amenities: string[] = []
  for (const [palabra, mapeado] of Object.entries(AMENITIES_MAP)) {
    if (!amenities.includes(mapeado) && fuentes.some(f => f.includes(palabra))) amenities.push(mapeado)
  }
  return amenities
}

export function fichaToSale(ficha: Ficha): { prop: SaleFields; avisos: string[] } {
  const property = ficha.property || {}
  const avisos: string[] = []

  const direccion = (property.address || '').trim()
  const barrio = (property.location || '').split('|')[0].trim()
  const tipo = mapTipoVenta(property)

  // Precio: `operations` es un objeto con una clave por operación
  // (`{ Sale: ["USD 120.000"], Rent: [...] }`). Si no hay operación de venta,
  // la ficha es de alquiler y se está cargando en el catálogo equivocado.
  const operaciones = property.operations || {}
  const claveVenta = Object.keys(operaciones).find(k => /sale|venta/i.test(k))
  const precioTexto = claveVenta ? (operaciones[claveVenta] || [])[0] || '' : ''
  const { precio, moneda } = parsePrecio(precioTexto) || { precio: 0, moneda: 'USD' as const }
  if (!claveVenta) {
    const otras = Object.keys(operaciones).join(', ') || 'ninguna'
    avisos.push(`OJO: la ficha no tiene operación de venta (tiene: ${otras}) — cargá el precio a mano`)
  } else if (!precio) {
    avisos.push(`precio: no pude leer "${precioTexto}", cargalo a mano`)
  }

  const descripcion = (ficha.edited_ficha?.description || '').trim() || stripHtml(property.description || '')
  const titulo = `${capitalize(tipo)} en ${barrio}`
  const texto = `${descripcion}\n${titulo}`

  const listas = [
    ...(property.additional || property.additionals || []),
    ...(property.rooms || []),
    ...(property.services || []),
    ...(property.tags || []).map(t => t.name || ''),
  ]
  const amenities = detectarAmenities(listas, texto)

  const superficie = medida(property, 'total_surface') || medida(property, 'surface') || 0
  const superficieCubierta = medida(property, 'roofed_surface')
  if (!superficie) avisos.push('superficie: la ficha no trae los m² totales y son obligatorios — cargalos a mano')

  const expensasTexto = (property.operation_block_data || []).find(b => /expensa/i.test(b.name || ''))?.value
  const expensas = expensasTexto ? parseFloat(String(expensasTexto).replace(/[.,]/g, '')) : undefined

  // "No especificado" es lo que manda Tokko cuando nadie cargó el dato, que es
  // casi siempre. Se deja en false y se avisa, en vez de publicar "apto crédito"
  // sobre algo que nadie confirmó.
  const credito = String(basico(property, 'credit_eligible') || '')
  const aptoCredito = /^(apto|s[ií]|true)/i.test(credito.trim())
  if (!aptoCredito && credito) avisos.push(`aptoCredito: la ficha dice "${credito}" — confirmalo antes de tildarlo`)

  const lat = parseFloat(property.geolocation?.lat || '')
  const lng = parseFloat(property.geolocation?.lng || '')
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng)

  const status = property.status?.name
  const disponibleEnTokko = esDisponibleSegunTokko(status)

  // La galería: la portada primero y después el resto, sin repetirla. Las que
  // eligió la ficha ganan sobre las de la propiedad, que es el orden en que las
  // ve el colega. El tope de 20 lo vuelve a aplicar el formulario.
  const dePropiedad = property.pictures || {}
  const deFicha = ficha.edited_ficha?.pictures
  const fuente = (deFicha?.images || []).length ? deFicha! : dePropiedad
  const fotos = [...new Set([
    fuente.front_cover_image?.url || dePropiedad.front_cover_image?.url || '',
    ...(fuente.images || []),
  ].filter(Boolean))].slice(0, 20)

  const prop: SaleFields = {
    titulo,
    barrio,
    tipo,
    precio,
    moneda,
    // Cualquier cosa que no sea "Disponible" en Tokko queda fuera del catálogo
    // público: "vendido" no se muestra. Es el default seguro — que no se
    // publique sola una propiedad que ya no está a la venta.
    disponibilidad: disponibleEnTokko === false ? 'vendido' : 'disponible',
    superficie,
    antiguedad: String(basico(property, 'age') || '').trim(),
    aptoCredito,
    amueblado: /amoblad|amueblad|equipad/i.test(`${texto}\n${listas.join('\n')}`),
    amenities,
    descripcion,
    fotos,
    direccion,
    direccionUrl: tieneCoords ? `https://www.google.com/maps?q=${lat},${lng}` : '',
    whatsappMsg: `Hola! Me interesa el ${tipo} en venta en ${barrio} (${direccion}). ¿Podría darme más información?`,
    // La ficha de ficha.info es el link para colegas: no va como "Ver
    // publicación completa", que es un botón público. `fichaUrl` es para
    // Zonaprop/Argenprop y se carga a mano.
    fichaUrl: '',
    // `esPropio` no se deduce: ver el comentario gemelo en fichaToRental().
    esPropio: false,
  }
  if (superficieCubierta) prop.superficieCubierta = superficieCubierta
  const ambientes = numeroBasico(property, 'room_amount')
  if (ambientes) prop.ambientes = ambientes
  const banios = numeroBasico(property, 'bathroom_amount')
  if (banios) prop.banios = banios
  if (expensas) prop.expensas = expensas
  if (tieneCoords) {
    prop.lat = lat
    prop.lng = lng
  }

  if (disponibleEnTokko === false) avisos.push(`Tokko marca esta ficha como "${status}" → quedó "vendido"`)

  const company = property.company?.name || ficha.branch?.company?.name
  if (company && company.toLowerCase().includes(MI_INMOBILIARIA_TOKKO.toLowerCase())) {
    avisos.push(`la ficha está publicada bajo "${company}" — marcá "es propio" si la propiedad es de BairesRental`)
  } else if (company) {
    avisos.push(`OJO: la ficha aparece bajo otra inmobiliaria ("${company}")`)
  }

  if (!fotos.length) avisos.push('la ficha no trae fotos — subilas desde el formulario')
  else avisos.push(`${fotos.length} foto${fotos.length === 1 ? '' : 's'} del CDN de Tokko: las copiamos a nuestro Storage al guardar`)

  return { prop, avisos }
}

// Igual que `proximoIdAlq` pero para la serie `ven-NN` de `sales`. Los ids
// históricos (`lafinur-3000`, `poli-venta-01`) no matchean y quedan afuera.
export function proximoIdVen(ids: string[]): string {
  return proximoIdDeSerie(ids, 'ven')
}
