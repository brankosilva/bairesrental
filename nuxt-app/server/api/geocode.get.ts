import { extractLatLng } from '~/utils/geo'

// Resuelve el pin del mapa de una propiedad: el par lat/lng que después dibuja
// el catálogo (app/utils/geo.ts → CatalogMap.vue). Lo llama el formulario del
// panel (PropertyLocationFields.vue) mientras se carga, y otra vez al guardar,
// por si quedó sin pin.
//
// Recibe la dirección (`q`), el link de Google Maps (`url`) o los dos, y prueba
// en este orden, de más a menos confiable:
//
//   1. las coordenadas que el link ya trae adentro;
//   2. el redirect del link corto (maps.app.goo.gl, share.google);
//   3. geocoding de la dirección contra Nominatim/OpenStreetMap.
//
// Los pasos 1 y 2 son el pin exacto que eligió una persona; el 3 es una
// dirección interpretada por un geocoder, que puede caer a cuadras.
//
// Va por el servidor y no por fetch desde el navegador por dos motivos:
// Nominatim pide un User-Agent identificable y como máximo 1 request/segundo
// (https://operations.osmfoundation.org/policies/nominatim/), y el navegador no
// puede setearlo; y el redirect del link corto no se puede seguir desde el
// cliente por CORS — que es justo el link que comparte Google Maps desde el
// celular, el que más pega un vendedor.
//
// Es la misma cascada que corre scripts/resolve-map-coords.js sobre el catálogo
// ya cargado, con la misma limpieza de la dirección y el mismo recuadro de CABA
// — si cambian las mañas de uno, mirar el otro. La diferencia es el momento:
// allá se resuelve lo que ya está en Firestore, acá se resuelve al cargarlo.

// CABA entra holgadamente acá. Todas las propiedades del catálogo están en la
// ciudad, así que cualquier coordenada de afuera está mal: Nominatim, cuando no
// encuentra la dirección, devuelve cualquier cosa (el centro de Argentina, una
// calle homónima en otra provincia). El chequeo corre para las tres fuentes: un
// link corto también puede terminar en el medio de La Pampa.
const CABA = { latMin: -34.75, latMax: -34.5, lngMin: -58.56, lngMax: -58.32 }

function enCABA([lat, lng]: [number, number]) {
  return lat >= CABA.latMin && lat <= CABA.latMax && lng >= CABA.lngMin && lng <= CABA.lngMax
}

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

const ES_CORTO = /goo\.gl|share\.google/

// Sigue el link corto hasta la URL larga. Los de maps.app.goo.gl caen en una
// ficha de Google Maps, que trae el `@lat,lng`. Los de share.google caen en una
// búsqueda de Google cuyo `q` es la dirección postal normalizada — no sirve
// como pin, pero sí como texto para geocodificar, y suele ser más limpio que el
// campo `direccion` ("Maipú 740, C1006ACJ" en vez de "Maipú 740 Centro").
async function seguirRedirect(url: string) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).catch(() => null)
  if (!res) return null

  const coords = extractLatLng(res.url)
  if (coords) return { coords }

  const m = res.url.match(/[?&]q=([^&]+)/)
  return m ? { direccion: decodeURIComponent(m[1]!.replace(/\+/g, ' ')) } : null
}

async function geocodificar(consulta: string) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar' +
    // bounded=1 + viewbox: que ni siquiera considere resultados fuera de CABA.
    `&viewbox=${CABA.lngMin},${CABA.latMax},${CABA.lngMax},${CABA.latMin}&bounded=1` +
    `&q=${encodeURIComponent(`${consulta}, Ciudad Autónoma de Buenos Aires, Argentina`)}`

  const res = await $fetch<{ lat: string; lon: string; display_name: string }[]>(url, {
    headers: { 'User-Agent': 'BairesRental/1.0 (bairesrentalok@gmail.com)' },
  }).catch(() => null)

  const hit = res?.[0]
  if (!hit) return null

  const coords: [number, number] = [parseFloat(hit.lat), parseFloat(hit.lon)]
  return enCABA(coords) ? { coords, etiqueta: hit.display_name } : null
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default defineEventHandler(async (event) => {
  const params = getQuery(event)
  const q = String(params.q || '').trim()
  const url = String(params.url || '').trim()

  // 1. El link, si ya trae las coordenadas adentro.
  const enElLink = extractLatLng(url)
  if (enElLink && enCABA(enElLink)) {
    return {
      ok: true as const,
      lat: enElLink[0],
      lng: enElLink[1],
      etiqueta: 'el pin del link de Maps',
      precision: 'altura' as const,
      origen: 'link' as const,
    }
  }

  // 2. El link corto, siguiendo el redirect.
  let delRedirect = ''
  if (url && ES_CORTO.test(url)) {
    const r = await seguirRedirect(url)
    if (r?.coords && enCABA(r.coords)) {
      return {
        ok: true as const,
        lat: r.coords[0],
        lng: r.coords[1],
        etiqueta: 'el pin del link de Maps',
        precision: 'altura' as const,
        origen: 'redirect' as const,
      }
    }
    if (r?.direccion) delRedirect = r.direccion
  }

  // 3. Geocoding. Dos candidatos: la dirección normalizada que devolvió el
  // redirect y la que escribieron en el formulario. Gana el primero que
  // resuelva — a veces el redirect devuelve una esquina donde la ficha tenía la
  // altura exacta, y a veces al revés.
  const candidatos = [...new Set([delRedirect, q].map(limpiar).filter(Boolean))]
  if (!candidatos.length) {
    return { ok: false as const, motivo: 'Escribí una dirección primero.' }
  }

  for (const [i, consulta] of candidatos.entries()) {
    if (i) await dormir(1100) // el límite de Nominatim es 1 request/segundo
    const hit = await geocodificar(consulta)
    if (!hit) continue
    // Nominatim arranca la etiqueta con la altura cuando matcheó la dirección
    // exacta. Si arranca con el nombre de la calle, matcheó la calle entera y
    // el pin puede estar a cuadras del edificio: se avisa para que lo miren.
    return {
      ok: true as const,
      lat: hit.coords[0],
      lng: hit.coords[1],
      etiqueta: hit.etiqueta,
      precision: /^\d/.test(hit.etiqueta) ? ('altura' as const) : ('calle' as const),
      origen: 'geocoding' as const,
      consulta,
    }
  }

  const consulta = candidatos[0]!
  return { ok: false as const, consulta, motivo: `No encontramos "${consulta}" en el mapa.` }
})
