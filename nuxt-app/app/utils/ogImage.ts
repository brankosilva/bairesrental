// Imágenes para los previews de link (WhatsApp, Facebook, X, LinkedIn, Slack).
//
// El problema que esto resuelve: las portadas que suben los vendedores son
// fotos de celular tal cual salen de la cámara — la de `rentals/Baires` eran
// 3024x4032 y 1.84 MB. WhatsApp descarta cualquier og:image de más de ~300 KB
// (no muestra nada, ni siquiera recortada) y todas las plataformas esperan un
// apaisado ~1.91:1, así que una vertical de 0.75 sale recortada o directamente
// no sale.
//
// La extensión `storage-resize-images` de Firebase genera, en el mismo
// directorio y ante cada upload, un derivado con el sufijo
// `_{ancho}x{alto}` antes de la extensión (convención propia de la
// extensión, ver su extension.yaml). O sea que
//   rentals/Baires/cover.jpg  ->  rentals/Baires/cover_1200x630.jpg
// y la URL del derivado se puede construir sin consultar nada: es la misma
// URL de descarga con el sufijo insertado.
//
// OJO: la extensión NO tiene backfill (los parámetros están comenteados
// upstream), así que los derivados de las portadas que ya estaban subidas
// los crea scripts/backfill-og-images.js volviendo a escribir cada objeto.
// Hasta que ese script corra, estas URLs devuelven 404 — ver el README de
// ese script para el orden de los pasos.

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

/** Sufijo que le pone la extensión al derivado. Tiene que coincidir con el
 *  parámetro IMG_SIZES con el que se instaló (`1200x630`). */
export const OG_IMAGE_SUFFIX = `_${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}`

export interface OgImage {
  url: string
  /** Solo cuando sabemos el tamaño real (o sea, cuando es un derivado nuestro).
   *  Declararlo evita que Facebook tenga que bajar y medir la imagen antes de
   *  poder dibujar la tarjeta — sin esto, el primer share sale sin foto. */
  width?: number
  height?: number
  type?: string
}

const STORAGE_URL_RE = /^(https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/)([^?#]+)/

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/**
 * Traduce la URL de una portada a la que hay que publicar en og:image.
 *
 * - Storage: apunta al derivado 1200x630 y devuelve medidas + mime.
 * - Cualquier otra cosa (CDN de Tokko, Airbnb, etc.): la deja intacta y sin
 *   medidas — no la generamos nosotros, no sabemos cuánto mide.
 * - Vacío / path local (`./images/...`): sin og:image, que es mejor que uno roto.
 */
export function ogImage(src?: string): OgImage | undefined {
  if (!src) return undefined

  const match = src.match(STORAGE_URL_RE)
  if (!match) {
    // Un path relativo no sirve: los crawlers necesitan una URL absoluta.
    if (src.startsWith('.') || src.startsWith('/')) return undefined
    return { url: src }
  }

  const [, base, encodedPath] = match
  const dot = encodedPath.lastIndexOf('.')
  if (dot === -1) return { url: src }

  const ext = encodedPath.slice(dot + 1).toLowerCase()
  if (!(ext in MIME_BY_EXT)) return { url: src }

  // Siempre `?alt=media` pelado, descartando el query original: la extensión
  // se instala con REGENERATE_TOKEN, o sea que el derivado tiene un token
  // propio distinto al del original y arrastrarlo daría un 403. Sin token
  // funciona igual porque storage.rules deja `allow read: if true` en
  // rentals/** y sales/**.
  return {
    url: `${base}${encodedPath.slice(0, dot)}${OG_IMAGE_SUFFIX}${encodedPath.slice(dot)}?alt=media`,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    type: MIME_BY_EXT[ext],
  }
}

/** Los <meta> de descripción no toleran bien los saltos de línea que traen
 *  las descripciones cargadas desde el admin. */
export function metaText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
