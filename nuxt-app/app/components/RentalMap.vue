<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import type { RentalProperty } from '~/types/property'
import { escapeHtml, extractLatLng } from '~/utils/geo'
import 'leaflet/dist/leaflet.css'

// Client-only (see the <ClientOnly> wrapper on the callsite) — Leaflet
// reaches for `window`/`document` at import time, so it can't run during SSR.
const props = defineProps<{
  rentals: RentalProperty[]
}>()

const localePath = useLocalePath()
const mapEl = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let markersLayer: LayerGroup | null = null

const LEAFLET_CDN = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images'
const BA_CENTER: [number, number] = [-34.6037, -58.3816]

function popupHtml(r: RentalProperty) {
  const precio = r.precio > 0 ? `${r.moneda || 'USD'} ${r.precio.toLocaleString('es-AR')}` : 'Consultar precio'
  const href = localePath(`/departamentos/${r.id}`)
  return `
    <div class="br-map-popup">
      ${r.imagen ? `<a href="${href}"><img src="${escapeHtml(r.imagen)}" alt="" loading="lazy" /></a>` : ''}
      <div class="br-map-popup-body">
        <strong>${escapeHtml(r.titulo)}</strong>
        <span>${escapeHtml(r.barrio)} · ${escapeHtml(r.tipo)}</span>
        <span class="br-map-popup-precio">${precio}</span>
        <a href="${href}">Ver detalles</a>
      </div>
    </div>
  `
}

function renderMarkers(L: typeof import('leaflet')) {
  if (!map || !markersLayer) return
  markersLayer.clearLayers()
  const bounds: [number, number][] = []
  for (const r of props.rentals) {
    const coords = extractLatLng(r.direccionUrl)
    if (!coords) continue
    bounds.push(coords)
    L.marker(coords).bindPopup(popupHtml(r)).addTo(markersLayer)
  }
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  } else {
    map.setView(BA_CENTER, 12)
  }
}

let leafletMod: typeof import('leaflet') | null = null

async function initMap() {
  const L = (await import('leaflet')).default
  leafletMod = L
  // Icon.Default._getIconUrl le antepone su `imagePath` autodetectado a lo
  // que devuelvan las opciones. Bajo Vite ese path se detecta como
  // `/_nuxt/@fs/.../leaflet/dist/images/`, así que las URLs absolutas del CDN
  // terminaban concatenadas detrás de él
  // (`/_nuxt/@fs/.../images/https://cdn.jsdelivr.net/...` → 404, marcadores
  // invisibles). Borrando el override queda el _getIconUrl de Icon, que usa
  // las opciones tal cual. Es el workaround estándar de Leaflet + bundlers.
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: `${LEAFLET_CDN}/marker-icon-2x.png`,
    iconUrl: `${LEAFLET_CDN}/marker-icon.png`,
    shadowUrl: `${LEAFLET_CDN}/marker-shadow.png`,
  })
  if (!mapEl.value) return
  map = L.map(mapEl.value, { zoomControl: true, scrollWheelZoom: false }).setView(BA_CENTER, 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  markersLayer = L.layerGroup().addTo(map)
  renderMarkers(L)
}

onMounted(initMap)
onBeforeUnmount(() => {
  map?.remove()
  map = null
})
watch(
  () => props.rentals,
  () => {
    if (leafletMod) renderMarkers(leafletMod)
  },
)
</script>

<template>
  <div ref="mapEl" class="br-map-canvas" role="img" aria-label="Mapa de propiedades"></div>
</template>
