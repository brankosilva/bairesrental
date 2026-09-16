// Pide el pin del mapa a /api/geocode. Lo usan los dos formularios del panel:
// PropertyLocationFields.vue mientras se carga la propiedad, y el onSubmit de
// rentals/[id].vue y sales/[id].vue como última chance antes de escribir en
// Firestore, para que nada salga sin pin por haberse salteado el paso.
//
// El servidor es el que resuelve, no el cliente: ver el encabezado del endpoint.

export type PinResuelto =
  | {
      ok: true
      lat: number
      lng: number
      etiqueta: string
      precision: 'altura' | 'calle'
      origen: 'link' | 'redirect' | 'geocoding'
      consulta?: string
    }
  | { ok: false; motivo: string; consulta?: string }

export async function resolverPin(direccion?: string | null, direccionUrl?: string | null) {
  const q = (direccion || '').trim()
  const url = (direccionUrl || '').trim()
  if (!q && !url) return null
  return $fetch<PinResuelto>('/api/geocode', { query: { q, url } }).catch(() => null)
}
