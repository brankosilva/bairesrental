// Rentals/sales only ever stored a Google Maps link (direccionUrl), never
// raw coordinates (see property.ts). Most of those links carry a lat/lng
// somewhere in the URL depending on how they were generated — this pulls
// it out client-side instead of requiring a data migration first.
// `maps.app.goo.gl` short links can't be resolved this way (no redirect
// follow from the browser) and simply won't produce a pin.
export function extractLatLng(url?: string | null): [number, number] | null {
  if (!url) return null

  // https://www.google.com/maps?q=-34.598,-58.452
  let m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  // https://www.google.com/maps/search/?api=1&query=-34.598,-58.452 — la coma
  // suele venir escapada como %2C. Es el formato que arma
  // scripts/fix-share-google-urls.js, así que aparece en el catálogo; faltaba
  // acá y esos listados quedaban sin pin aunque traían las coordenadas.
  m = url.match(/[?&]query=(-?\d+\.?\d*)(?:,|%2C)(-?\d+\.?\d*)/i)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  // https://www.google.com/maps/place/.../@-34.598,-58.452,17z
  m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  // .../data=...!3d-34.598!4d-58.452...
  m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  return null
}

// Centro de CABA (Obelisco). Algunos listados traen exactamente esta
// coordenada como placeholder en vez de la dirección real — si se dibujan
// quedan todos apilados sobre el Obelisco, que se lee como un error del mapa.
// Mejor no ubicarlos que ubicarlos mal.
const BA_CENTER: [number, number] = [-34.6037, -58.3816]

function isPlaceholder([lat, lng]: [number, number]) {
  return Math.abs(lat - BA_CENTER[0]) < 1e-4 && Math.abs(lng - BA_CENTER[1]) < 1e-4
}

/**
 * Coordenadas de una propiedad, en orden de confianza:
 *   1. `lat`/`lng` guardados en el documento — los escribe
 *      scripts/resolve-map-coords.js, resolviendo el link corto de Google
 *      Maps o geocodificando la dirección.
 *   2. lo que se pueda parsear de `direccionUrl` en el cliente.
 * Devuelve null si no hay nada ubicable, y el llamador saltea la propiedad.
 */
export function coordsFor(p: {
  lat?: number | null
  lng?: number | null
  direccionUrl?: string | null
}): [number, number] | null {
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    const c: [number, number] = [p.lat, p.lng]
    if (!isPlaceholder(c)) return c
  }
  const fromUrl = extractLatLng(p.direccionUrl)
  if (fromUrl && !isPlaceholder(fromUrl)) return fromUrl
  return null
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
