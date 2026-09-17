// Lee una ficha pública de fichaprop.tech — el "link para colegas" de Tencery,
// el equivalente al de ficha.info de Tokko — y la mapea al formato del catálogo
// de alquileres.
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

import type { RentalFields } from './ficha'

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

export function fichapropToRental(ficha: Fichaprop): { prop: RentalFields; avisos: string[] } {
  const p = ficha.property
  const avisos: string[] = []

  const direccion = (p.address || '').trim()
  const barrio = (p.neighborhoods?.name || '').trim()
  const tipo = mapTipo(p.bedrooms ?? 0)
  const descripcion = p.description || ''

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

  const fotos = [...(p.property_images || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const imagen = p.cover_image_url || fotos[0]?.image_url || ''

  // Pines del mapa, salvo que la ficha traiga el placeholder del Obelisco: en
  // ese caso el link de Maps apunta a la dirección escrita, que es lo único
  // cierto, y el pin lo resuelve después el formulario con resolverPin().
  const lat = Number(p.latitude)
  const lng = Number(p.longitude)
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng) && !esPlaceholder(lat, lng)
  const direccionUrl = tieneCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, CABA, Argentina`)}`

  const minimoMeses = extraerMinimoMeses(descripcion)

  const prop: RentalFields = {
    titulo: `${capitalize(tipo)} en ${barrio}`,
    barrio,
    tipo,
    precio: p.price || 0,
    moneda: p.currency === 'ARS' ? 'ARS' : 'USD',
    disponibilidad,
    disponibleDesde,
    // Las fichas de alquiler temporario vienen amobladas salvo aviso, pero el
    // texto rara vez dice "amoblado": dice "completamente equipado".
    amueblado: /amoblad|amueblad|mobiliad|equipad/i.test(descripcion),
    mascotas:
      p.pet_friendly === true ||
      (/mascota/i.test(descripcion) &&
        !/(no\s+se\s+aceptan?|sin|no\s+admite)[^\n.]*mascota/i.test(descripcion.toLowerCase())),
    serviciosIncluidos,
    minimoMeses,
    amenities: mapAmenities(descripcion),
    descripcion,
    imagen,
    // La ficha ES el álbum de fotos para colegas, igual que en ficha.info: va
    // en `fotos`; `fichaUrl` es sólo para links de Airbnb o Booking.
    fotos: ficha.url,
    fichaUrl: '',
    direccion,
    direccionUrl,
    ...(tieneCoords ? { lat, lng } : {}),
    whatsappMsg: `Hola! Me interesa el ${tipo} en ${barrio} (${direccion}). ¿Podría darme más información?`,
    esPropio: false,
  }

  if (disponibilidad !== 'disponible') {
    avisos.push(`la ficha está "${p.status}" en fichaprop → quedó "${disponibilidad}"`)
  }
  if (disponibleDesde) {
    avisos.push(`disponible desde ${disponibleDesde} — sale de la ficha, confirmalo`)
  }
  if (p.pet_friendly !== true && !/mascota/i.test(descripcion)) {
    avisos.push('mascotas: la ficha no dice nada — confirmalo con el propietario')
  }
  if (minimoMeses === 1 && !/m[ií]nim/i.test(descripcion)) {
    avisos.push('plazo mínimo: quedó en 1 mes porque la ficha no lo aclara')
  }
  if (!tieneCoords) {
    avisos.push('la ficha no trae coordenadas propias: el pin sale de la dirección, revisalo en el mapa')
  }
  const agencia = p.agencies?.name
  if (agencia) {
    avisos.push(`la ficha está publicada bajo "${agencia}" — si igual es propiedad propia, marcá "es propia"`)
  }
  if (!imagen) avisos.push('la ficha no trae foto de portada: subí una')

  return { prop, avisos }
}
