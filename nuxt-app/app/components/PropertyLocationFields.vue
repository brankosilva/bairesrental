<script setup lang="ts">
import { ref, computed } from 'vue'
import { extractLatLng } from '~/utils/geo'
import { resolverPin } from '~/utils/pin'

// La sección "Ubicación" de los dos formularios del panel (alquiler y venta),
// que eran dos copias del mismo par de campos.
//
// Además de dirección + link de Maps, acá se resuelve el PIN DEL MAPA, en dos
// pasos y en este orden:
//
//   1. si el link de Google Maps ya trae las coordenadas adentro, se sacan de
//      ahí — es el punto exacto que eligió una persona, la fuente más confiable;
//   2. si es un link corto (maps.app.goo.gl, share.google), lo sigue el
//      servidor: el navegador no puede por CORS, y adentro está el mismo pin;
//   3. si no, se geocodifica la dirección contra Nominatim/OpenStreetMap.
//
// Los tres pasos los resuelve /api/geocode, que es lo que vuelve a llamar el
// onSubmit de los dos formularios si acá quedó sin pin.
//
// Hasta ahora lat/lng las escribía SOLO scripts/resolve-map-coords.js, después
// de la carga y a mano: una propiedad recién cargada no tenía pin hasta que
// alguien se acordara de correr el script. El mapita de abajo es para confirmar
// a ojo que el pin cayó donde va, que es lo que ningún geocoder garantiza.

const props = defineProps<{
  direccion?: string
  direccionUrl?: string
  lat?: number | null
  lng?: number | null
}>()

const emit = defineEmits<{
  'update:direccion': [string]
  'update:direccionUrl': [string]
  'update:lat': [number | null]
  'update:lng': [number | null]
}>()

const direccionModel = computed({
  get: () => props.direccion ?? '',
  set: (v: string) => emit('update:direccion', v),
})
const direccionUrlModel = computed({
  get: () => props.direccionUrl ?? '',
  set: (v: string) => emit('update:direccionUrl', v),
})

const buscando = ref(false)
const etiqueta = ref('')
const aviso = ref('')

const tieneCoords = computed(() => typeof props.lat === 'number' && typeof props.lng === 'number')
const coordsTexto = computed(() => (tieneCoords.value ? `${props.lat!.toFixed(5)}, ${props.lng!.toFixed(5)}` : ''))

// El embed oficial de OpenStreetMap: sin API key, sin librería y sin tocar el
// Leaflet del catálogo, que se carga por CDN y sólo en las páginas públicas.
const mapaSrc = computed(() => {
  if (!tieneCoords.value) return ''
  const lat = props.lat!
  const lng = props.lng!
  const bbox = [lng - 0.004, lat - 0.002, lng + 0.004, lat + 0.002].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
})

function setCoords(lat: number | null, lng: number | null) {
  emit('update:lat', lat)
  emit('update:lng', lng)
}

function borrarPin() {
  setCoords(null, null)
  etiqueta.value = ''
  aviso.value = ''
}

// Al salir del campo del link: si trae las coordenadas adentro, ganan sobre
// cualquier geocoding posterior. Si es corto no las trae, y ahí va el servidor
// a seguir el redirect — es el caso más común, porque es el link que da el
// botón "Compartir" de Google Maps en el celular.
async function desdeLink() {
  const url = direccionUrlModel.value.trim()
  if (!url) return

  const c = extractLatLng(url)
  if (c) {
    setCoords(c[0], c[1])
    etiqueta.value = 'el pin del link de Maps'
    aviso.value = ''
    return
  }

  buscando.value = true
  try {
    const r = await resolverPin('', url)
    if (r?.ok) {
      setCoords(r.lat, r.lng)
      etiqueta.value = r.etiqueta
      aviso.value = ''
    }
  } finally {
    buscando.value = false
  }
}

async function ubicar() {
  const q = direccionModel.value.trim()
  if (!q || buscando.value) return
  buscando.value = true
  aviso.value = ''
  try {
    const r = await resolverPin(q, direccionUrlModel.value)
    if (!r?.ok) {
      const motivo = r?.motivo || 'No pudimos ubicar la dirección.'
      setCoords(null, null)
      etiqueta.value = ''
      aviso.value = `${motivo} Poné el link de Google Maps con el pin y lo sacamos de ahí.`
      return
    }
    setCoords(r.lat, r.lng)
    etiqueta.value = r.etiqueta
    if (r.precision === 'calle') {
      aviso.value = 'Ojo: matcheó la calle, no la altura — el pin puede estar a cuadras. Miralo en el mapa.'
    }
    // Si todavía no hay link de Maps, este pin sirve de link. Se completa sólo
    // cuando el campo está vacío: si alguien ya puso uno, manda el suyo.
    if (!direccionUrlModel.value.trim()) {
      direccionUrlModel.value = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
    }
  } finally {
    buscando.value = false
  }
}

// Al salir del campo de la dirección buscamos sola la primera vez. Después no:
// si ya hay pin, se vuelve a buscar sólo con el botón (el pin puede haberlo
// puesto una persona a mano y no se lo pisa por haber tocado la dirección).
function onDireccionBlur() {
  if (!tieneCoords.value) ubicar()
}
</script>

<template>
  <AdminSection title="Ubicación">
    <div class="row g-2">
      <div class="col-12 col-sm-6">
        <label class="form-label small is-required">Dirección</label>
        <input
          v-model="direccionModel"
          type="text"
          class="form-control"
          placeholder="Bauness 1100"
          required
          @blur="onDireccionBlur"
        />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label small is-required">Link de Google Maps</label>
        <input
          v-model="direccionUrlModel"
          type="url"
          inputmode="url"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          class="form-control"
          required
          @blur="desdeLink"
        />
      </div>
    </div>

    <div class="br-app-geo mt-2">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          :disabled="buscando || !direccionModel.trim()"
          @click="ubicar"
        >
          {{ buscando ? 'Buscando…' : '📍 Ubicar en el mapa' }}
        </button>
        <span v-if="tieneCoords" class="small text-success">✓ Con pin — {{ etiqueta || coordsTexto }}</span>
        <span v-else class="small text-muted">Sin pin: no va a aparecer en el mapa del catálogo.</span>
      </div>

      <p v-if="aviso" class="small text-danger mt-1 mb-0">{{ aviso }}</p>

      <template v-if="tieneCoords">
        <iframe
          class="br-app-geo-map"
          :src="mapaSrc"
          loading="lazy"
          title="Ubicación de la propiedad en el mapa"
        ></iframe>
        <div class="d-flex flex-wrap align-items-center gap-2 small text-muted">
          <span>{{ coordsTexto }}</span>
          <button type="button" class="btn btn-link btn-sm p-0 border-0" @click="borrarPin">
            No es acá — borrar el pin
          </button>
        </div>
      </template>
    </div>
  </AdminSection>
</template>
