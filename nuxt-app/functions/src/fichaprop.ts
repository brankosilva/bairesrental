// Lee una ficha pública de fichaprop.tech — el "link para colegas" de Tencery,
// el equivalente al de ficha.info de Tokko — y la mapea al catálogo, de
// alquiler o de venta.
//
// Acá no hay nada para scrapear como en ficha.ts: fichaprop.tech es un SPA de
// Vite, el HTML viene vacío y los datos los pide el navegador a Supabase. Así
// que este módulo hace exactamente lo mismo que hace la página, pero desde el
// server:
//
//   1. `property_fichas?token=eq.<uuid>` → a qué propiedad apunta el link
//   2. `properties?id=eq.<uuid>`         → la propiedad, con barrio, fotos,
//                                          servicios e inmobiliaria
//
// OJO: esta lógica vive dos veces. La copia de la terminal está en
// scripts/lib/fichaprop.js (el fetch) y en scripts/add-from-ficha.js +
// scripts/add-from-tencery.js (el mapeo), porque functions/ es un paquete
// aparte que no puede importar de scripts/. Si tocás una, tocá la otra: el
// mapeo tiene que dar lo mismo desde el panel que desde la terminal.

import type { RentalFields, SaleFields } from './ficha'

const TIMEOUT_MS = 15000

// El backend de fichaprop.tech y su clave *publishable*, las dos tal cual
// vienen adentro del bundle público del sitio (`/assets/index-*.js`). Es la
// clave que usa cualquier visitante desde el navegador para leer una ficha
// compartida, no un secreto nuestro. Si algún día fichaprop la rota, se
// actualiza acá y en scripts/lib/fichaprop.js.
const SUPABASE_URL = 'https://dfqgrmqwndofatfwfrxk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_RdqZr8uGLEvhmchShCf4jg_q13OKhYq'

// El token de la ficha es el UUID que va en la URL.
const FICHAPROP_URL_RE =
  /^https?:\/\/(?:www\.)?fichaprop\.tech\/ficha\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i

export function esUrlDeFichaprop(url: string): boolean {
  return FICHAPROP_URL_RE.test((url || '').trim())
}

function tokenDe(url: string): string {
  const m = (url || '').trim().match(FICHAPROP_URL_RE)
  if (!m) throw new Error(`No parece una URL de fichaprop.tech: "${url}"`)
  return m[1].toLowerCase()
}

/** Sin querystring: es la forma que se guarda en `fotos` y en `origen.url`. */
export function urlCanonica(url: string): string {
  return `https://www.fichaprop.tech/ficha/${tokenDe(url)}`
}

// ─── La ficha ────────────────────────────────────────────────────────────────

export interface FichapropProperty {
  description?: string | null
  price?: number | null
  currency?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  /** m² totales. En venta es obligatorio; en alquiler no se usa. */
  area?: number | null
  expenses_amount?: number | null
  cover_image_url?: string | null
  status?: string | null
  rented_at?: string | null
  available_from?: string | null
  pet_friendly?: boolean | null
  full_package?: boolean | null
  neighborhoods?: { name?: string | null } | null
  agencies?: { name?: string | null } | null
  property_images?: { image_url?: string | null; display_order?: number | null }[] | null
  property_services?: { is_included?: boolean | null; services?: { name?: string | null } | null }[] | null
}

export interface Fichaprop {
  token: string
  /** La URL canónica de la ficha, que es el álbum de fotos para colegas. */
  url: string
  property: FichapropProperty
}

// Lo que la página pide de `properties`, más lo que a nosotros nos sirve y ella
// no muestra: coordenadas, `full_package`, `available_from`, `rented_at`.
// `*` trae la fila entera, que es más corto que enumerar veinte columnas.
const SELECT_PROPIEDAD = [
  '*',
  'neighborhoods(name)',
  'agencies(name)',
  'property_images(image_url,display_order)',
  'property_services(is_included,services(name))',
].join(',')

async function api<T>(path: string): Promise<T[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al pedir ${path.split('?')[0]} a fichaprop.tech`)
  }
  return (await resp.json()) as T[]
}

// Tira error en vez de devolver una propiedad a medias: mejor cortar que
// completar el formulario con una ficha vacía.
export async function fetchFichaprop(url: string): Promise<Fichaprop> {
  const token = tokenDe(url)

  const [ficha] = await api<{ property_id: string }>(`property_fichas?select=property_id&token=eq.${token}`)
  if (!ficha) {
    throw new Error('No encontré esa ficha en fichaprop.tech (¿el link se dio de baja?)')
  }

  const [property] = await api<FichapropProperty>(`properties?select=${SELECT_PROPIEDAD}&id=eq.${ficha.property_id}`)
  if (!property) {
    throw new Error('La ficha existe pero la propiedad ya no es pública en fichaprop.tech')
  }

  return { token, url: urlCanonica(url), property }
}

// ─── Mapeo ───────────────────────────────────────────────────────────────────

// Tencery cuenta dormitorios; el catálogo, ambientes.
function mapTipo(bedrooms: number): string {
  if (bedrooms === 0) return 'monoambiente'
  if (bedrooms === 1) return '2 ambientes'
  if (bedrooms === 2) return '3 ambientes'
  return '4+ ambientes'
}

const AMENITIES_MAP: Record<string, string> = {
  pileta: 'pileta',
  piscina: 'pileta',
  gimnasio: 'gimnasio',
  gym: 'gimnasio',
  laundry: 'laundry',
  lavanderia: 'laundry',
  lavandería: 'laundry',
  parrilla: 'parrilla',
  quincho: 'parrilla',
  barbacoa: 'parrilla',
  terraza: 'terraza',
  rooftop: 'terraza',
  cochera: 'cochera',
  garaje: 'cochera',
  garage: 'cochera',
  estacionamiento: 'cochera',
  sauna: 'sauna',
  solarium: 'solárium',
  solárium: 'solárium',
  'seguridad 24hs': 'seguridad 24hs',
  'seguridad 24 hs': 'seguridad 24hs',
  'vigilancia 24hs': 'seguridad 24hs',
  portería: 'seguridad 24hs',
  porteria: 'seguridad 24hs',
  jacuzzi: 'jacuzzi',
  lavarropas: 'lavarropas',
}

// La ficha de Tencery no tiene un campo de amenities: lo único que hay es el
// texto de la descripción.
function mapAmenities(descripcion: string): string[] {
  const texto = descripcion.toLowerCase()
  const result: string[] = []
  for (const [palabra, mapped] of Object.entries(AMENITIES_MAP)) {
    if (!result.includes(mapped) && texto.includes(palabra)) result.push(mapped)
  }
  return result
}

function extraerMinimoMeses(desc: string): number {
  const m =
    desc.match(/plazo\s*m[ií]nimo[^:]*:\s*(\d+)\s*mes/i) ||
    desc.match(/estad[ií]a\s*m[ií]nima[^:]*:\s*(\d+)\s*mes/i) ||
    desc.match(/alquiler\s*m[ií]nimo[:\s]+(\d+)\s*mes/i) ||
    desc.match(/m[ií]nimo[:\s]+(\d+)\s*mes/i) ||
    desc.match(/(\d+)\s*mes(?:es)?\s*m[ií]nimo/i)
  return m ? parseInt(m[1], 10) : 1
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

// El centro de CABA, que es lo que fichaprop deja como coordenada cuando nadie
// movió el pin. Si se dibuja, la propiedad queda parada sobre el Obelisco —
// ver esPlaceholder() en scripts/resolve-map-coords.js.
const CENTRO_CABA = [-34.6037, -58.3816]
function esPlaceholder(lat: number, lng: number): boolean {
  return Math.abs(lat - CENTRO_CABA[0]) < 1e-4 && Math.abs(lng - CENTRO_CABA[1]) < 1e-4
}

// Lo que sale igual para los dos catálogos. La ficha es una sola: lo único que
// cambia entre alquiler y venta es qué campos se miran y cómo se arma el precio.
interface Comun {
  direccion: string
  barrio: string
  tipo: string
  descripcion: string
  amenities: string[]
  amueblado: boolean
  /** La portada primero y después el resto, sin repetirla, con el tope de 20. */
  fotos: string[]
  lat: number
  lng: number
  tieneCoords: boolean
  direccionUrl: string
}

function comunDeFicha(p: FichapropProperty): Comun {
  const direccion = (p.address || '').trim()
  const descripcion = p.description || ''

  const ordenadas = [...(p.property_images || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((f) => f.image_url || '')
  const fotos = [...new Set([p.cover_image_url || '', ...ordenadas].filter(Boolean))].slice(0, 20)

  // Pines del mapa, salvo que la ficha traiga el placeholder del Obelisco: en
  // ese caso el link de Maps apunta a la dirección escrita, que es lo único
  // cierto, y el pin lo resuelve después el formulario con resolverPin().
  const lat = Number(p.latitude)
  const lng = Number(p.longitude)
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng) && !esPlaceholder(lat, lng)

  return {
    direccion,
    barrio: (p.neighborhoods?.name || '').trim(),
    tipo: mapTipo(p.bedrooms ?? 0),
    descripcion,
    amenities: mapAmenities(descripcion),
    // Las fichas de alquiler temporario vienen amobladas salvo aviso, pero el
    // texto rara vez dice "amoblado": dice "completamente equipado".
    amueblado: /amoblad|amueblad|mobiliad|equipad/i.test(descripcion),
    fotos,
    lat,
    lng,
    tieneCoords,
    direccionUrl: tieneCoords
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, CABA, Argentina`)}`,
  }
}

// Los avisos que valen para los dos catálogos.
function avisosComunes(p: FichapropProperty, c: Comun): string[] {
  const avisos: string[] = []
  if (!c.tieneCoords) {
    avisos.push('la ficha no trae coordenadas propias: el pin sale de la dirección, revisalo en el mapa')
  }
  const agencia = p.agencies?.name
  if (agencia) {
    avisos.push(`la ficha está publicada bajo "${agencia}" — si igual es propiedad propia, marcá "es propia"`)
  }
  return avisos
}

export function fichapropToRental(ficha: Fichaprop): { prop: RentalFields; avisos: string[] } {
  const p = ficha.property
  const c = comunDeFicha(p)
  const avisos: string[] = []

  // Estado: Tencery lo publica en `status` y marca `rented_at` cuando se
  // alquila. `available_from` en el futuro es una propiedad que todavía no se
  // puede ocupar, así que entra como reservada con fecha.
  let disponibilidad: RentalFields['disponibilidad'] = 'disponible'
  let disponibleDesde = ''
  if (p.rented_at || p.status === 'rented') disponibilidad = 'reservado'
  else if (p.status && p.status !== 'published') disponibilidad = 'no disponible'
  if (p.available_from && new Date(p.available_from) > new Date()) {
    disponibleDesde = p.available_from.slice(0, 10)
    disponibilidad = 'reservado'
  }

  // `serviciosIncluidos` del catálogo es "incluye luz Y wifi". La ficha los
  // lista uno por uno, que es más confiable que el `full_package` de Tencery
  // ("todo incluido" puede ser expensas y nada más).
  const incluidos = (p.property_services || [])
    .filter((s) => s.is_included)
    .map((s) => (s.services?.name || '').toLowerCase())
  let serviciosIncluidos = p.full_package === true
  if (incluidos.length) {
    serviciosIncluidos =
      incluidos.some((s) => /luz|electricidad/.test(s)) && incluidos.some((s) => /internet|wifi/.test(s))
  } else {
    avisos.push('serviciosIncluidos: la ficha no lista servicios — confirmalo')
  }

  const minimoMeses = extraerMinimoMeses(c.descripcion)

  const prop: RentalFields = {
    titulo: `${capitalize(c.tipo)} en ${c.barrio}`,
    barrio: c.barrio,
    tipo: c.tipo,
    precio: p.price || 0,
    moneda: p.currency === 'ARS' ? 'ARS' : 'USD',
    disponibilidad,
    disponibleDesde,
    amueblado: c.amueblado,
    mascotas:
      p.pet_friendly === true ||
      (/mascota/i.test(c.descripcion) &&
        !/(no\s+se\s+aceptan?|sin|no\s+admite)[^\n.]*mascota/i.test(c.descripcion.toLowerCase())),
    serviciosIncluidos,
    minimoMeses,
    amenities: c.amenities,
    descripcion: c.descripcion,
    imagen: c.fotos[0] || '',
    // La ficha ES el álbum de fotos para colegas, igual que en ficha.info: va
    // en `fotos`; `fichaUrl` es sólo para links de Airbnb o Booking.
    fotos: ficha.url,
    fichaUrl: '',
    direccion: c.direccion,
    direccionUrl: c.direccionUrl,
    ...(c.tieneCoords ? { lat: c.lat, lng: c.lng } : {}),
    whatsappMsg: `Hola! Me interesa el ${c.tipo} en ${c.barrio} (${c.direccion}). ¿Podría darme más información?`,
    esPropio: false,
  }

  if (disponibilidad !== 'disponible') {
    avisos.push(`la ficha está "${p.status}" en fichaprop → quedó "${disponibilidad}"`)
  }
  if (disponibleDesde) {
    avisos.push(`disponible desde ${disponibleDesde} — sale de la ficha, confirmalo`)
  }
  if (p.pet_friendly !== true && !/mascota/i.test(c.descripcion)) {
    avisos.push('mascotas: la ficha no dice nada — confirmalo con el propietario')
  }
  if (minimoMeses === 1 && !/m[ií]nim/i.test(c.descripcion)) {
    avisos.push('plazo mínimo: quedó en 1 mes porque la ficha no lo aclara')
  }
  avisos.push(...avisosComunes(p, c))
  if (!prop.imagen) avisos.push('la ficha no trae foto de portada: subí una')

  return { prop, avisos }
}

// La misma ficha, cargada como venta. fichaprop.tech es un catálogo de alquiler
// temporario: no hay operación de venta en sus datos, así que lo que no existe
// —precio de venta, antigüedad, apto crédito— queda vacío y avisado, como hace
// fichaToSale() cuando la ficha de Tokko no trae operación de venta. Todo lo
// demás (dirección, barrio, metros, ambientes, baños, expensas, amenities,
// descripción y las hasta 20 fotos de la galería) sale igual que en alquiler.
export function fichapropToSale(ficha: Fichaprop): { prop: SaleFields; avisos: string[] } {
  const p = ficha.property
  const c = comunDeFicha(p)
  const avisos: string[] = []

  // El `price` de la ficha es el valor POR MES del alquiler temporario. Meterlo
  // como precio de venta sería publicar un número inventado, así que va en 0
  // ("Consultar precio" en el catálogo) y se carga a mano.
  const porMes = p.price ? `${p.currency || 'USD'} ${p.price}` : 'sin precio'
  avisos.push(`precio: la ficha es de alquiler temporario (${porMes} por mes) y no trae valor de venta — cargalo a mano`)

  const superficie = Number(p.area) || 0
  if (!superficie) avisos.push('superficie: la ficha no trae los m² y son obligatorios — cargalos a mano')

  // Cualquier cosa que no sea publicada queda fuera del catálogo público, que
  // es el default seguro: que no se publique sola una propiedad que ya no está.
  const disponibilidad: SaleFields['disponibilidad'] =
    p.rented_at || (p.status && p.status !== 'published') ? 'vendido' : 'disponible'

  const prop: SaleFields = {
    titulo: `${capitalize(c.tipo)} en ${c.barrio}`,
    barrio: c.barrio,
    tipo: c.tipo,
    precio: 0,
    moneda: 'USD',
    disponibilidad,
    superficie,
    antiguedad: '',
    // La ficha no dice nada del crédito: se deja en false y se avisa, en vez de
    // publicar "apto crédito" sobre algo que nadie confirmó.
    aptoCredito: false,
    amueblado: c.amueblado,
    amenities: c.amenities,
    descripcion: c.descripcion,
    fotos: c.fotos,
    direccion: c.direccion,
    direccionUrl: c.direccionUrl,
    whatsappMsg: `Hola! Me interesa el ${c.tipo} en venta en ${c.barrio} (${c.direccion}). ¿Podría darme más información?`,
    // El link para colegas no va como "Ver publicación completa", que es un
    // botón público: eso es para Zonaprop/Argenprop y se carga a mano. El link
    // de la ficha igual queda guardado en `origen`, que lo sella el callable.
    fichaUrl: '',
    esPropio: false,
  }

  // Tencery cuenta dormitorios; el catálogo, ambientes: un 3 dormitorios es un
  // 4 ambientes, el mismo criterio que usa mapTipo().
  if (p.bedrooms != null) prop.ambientes = p.bedrooms + 1
  if (p.bathrooms != null) prop.banios = p.bathrooms
  if (p.expenses_amount) prop.expensas = p.expenses_amount
  if (c.tieneCoords) {
    prop.lat = c.lat
    prop.lng = c.lng
  }

  if (disponibilidad === 'vendido') {
    avisos.push(`la ficha está "${p.status}" en fichaprop → quedó "vendido" y no se publica`)
  }
  avisos.push('antigüedad y apto crédito: la ficha no los trae — completalos si los sabés')
  avisos.push(...avisosComunes(p, c))
  if (!c.fotos.length) avisos.push('la ficha no trae fotos — subilas desde el formulario')
  else avisos.push(`${c.fotos.length} foto${c.fotos.length === 1 ? '' : 's'} de fichaprop: las copiamos a nuestro Storage al guardar`)

  return { prop, avisos }
}
