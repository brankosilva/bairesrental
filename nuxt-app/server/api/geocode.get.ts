// Convierte una dirección ("Bauness 1100") en el par lat/lng que después
// dibuja el pin del catálogo (app/utils/geo.ts → CatalogMap.vue). Lo llama el
// formulario del panel desde PropertyLocationFields.vue.
//
// Va por el servidor y no por fetch desde el navegador porque Nominatim pide
// un User-Agent identificable y como máximo 1 request/segundo
// (https://operations.osmfoundation.org/policies/nominatim/), y el navegador
// no puede setear User-Agent.
//
// Es el mismo proveedor que usa scripts/resolve-map-coords.js para el backfill
// masivo, con la misma limpieza de la dirección y el mismo recuadro de CABA —
// si cambian las mañas de uno, mirar el otro. La diferencia es el momento:
// allá se resuelve lo que ya está cargado, acá se resuelve mientras se carga.

// CABA entra holgadamente acá. Todas las propiedades del catálogo están en la
// ciudad, así que cualquier coordenada de afuera está mal: Nominatim, cuando no
// encuentra la dirección, devuelve cualquier cosa (el centro de Argentina, una
// calle homónima en otra provincia).
const CABA = { latMin: -34.75, latMax: -34.5, lngMin: -58.56, lngMax: -58.32 }

// Nominatim es quisquilloso con lo que venga después de la altura: el código
// postal ("C1115AAP"), el barrio pegado al final ("Maipú 740 Centro") o un "al"
// antes del número ("Teodoro García al 2500") le hacen devolver cero resultados
// o matchear la calle entera en vez del portal.
function limpiar(dir: string): string {
  return dir
    .replace(/\bal\s+(?=\d)/gi, '')
    .replace(/\bC\d{4}[A-Z]{0,3}\b/g, '')
    .replace(/^(.*\d+)\b.*$/, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q || '').trim()
  if (!q) return { ok: false as const, motivo: 'Escribí una dirección primero.' }

  const consulta = limpiar(q) || q
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar' +
    // bounded=1 + viewbox: que ni siquiera considere resultados fuera de CABA.
    `&viewbox=${CABA.lngMin},${CABA.latMax},${CABA.lngMax},${CABA.latMin}&bounded=1` +
    `&q=${encodeURIComponent(`${consulta}, Ciudad Autónoma de Buenos Aires, Argentina`)}`

  const res = await $fetch<{ lat: string; lon: string; display_name: string }[]>(url, {
    headers: { 'User-Agent': 'BairesRental/1.0 (bairesrentalok@gmail.com)' },
  }).catch(() => null)

  const hit = res?.[0]
  if (!hit) return { ok: false as const, consulta, motivo: `No encontramos "${consulta}" en el mapa.` }

  const lat = parseFloat(hit.lat)
  const lng = parseFloat(hit.lon)
  if (lat < CABA.latMin || lat > CABA.latMax || lng < CABA.lngMin || lng > CABA.lngMax) {
    return { ok: false as const, consulta, motivo: `"${consulta}" cayó fuera de CABA.` }
  }

  // Nominatim arranca la etiqueta con la altura cuando matcheó la dirección
  // exacta. Si arranca con el nombre de la calle, matcheó la calle entera y el
  // pin puede estar a cuadras del edificio: se avisa para que lo miren.
  const precision = /^\d/.test(hit.display_name) ? 'altura' : 'calle'

  return { ok: true as const, lat, lng, etiqueta: hit.display_name, precision, consulta }
})
