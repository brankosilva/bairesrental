<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { escapeHtml } from '~/utils/geo'
import 'maplibre-gl/dist/maplibre-gl.css'
// Ver la nota de `vite.worker` en nuxt.config.ts: sin esto maplibre busca su
// worker en una URL que no existe en el bundle y el mapa queda en blanco.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// Client-only (ver el <ClientOnly> del callsite) — MapLibre toca
// `window`/`document` al importarse, así que no puede correr en SSR.
//
// NUXT-NEW: el mapa entero. El sitio estático no tiene ningún mapa en el
// catálogo (js/google_map.js existe pero es un resto del theme original y
// ninguna página lo carga).
//
// Antes esto era RentalMap.vue y sabía leer `RentalProperty`. Ahora recibe
// puntos ya normalizados para que alquileres y ventas compartan el mismo
// componente: cada página resuelve lo suyo (la portada de un alquiler es
// `imagen`, la de una venta es `fotos[0]`) y acá solo se dibuja.
export interface MapPoint {
  id: string
  coords: [number, number]
  titulo: string
  subtitulo: string
  precio: string
  imagen?: string
  href: string
}

const props = defineProps<{
  points: MapPoint[]
  verDetalles: string
}>()

const mapEl = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
let markers: Marker[] = []
let resizeObs: ResizeObserver | null = null

// `coords` viene [lat, lng] (orden Leaflet, que es el que usan las páginas y
// utils/geo). MapLibre trabaja en [lng, lat], así que se da vuelta acá y el
// resto del proyecto no se entera.
const BA_CENTER: [number, number] = [-58.3816, -34.6037]

// Basemap vectorial de OpenFreeMap con el estilo "Liberty": gratis, sin API
// key ni registro, y con la paleta clara + labels finas de un mapa moderno en
// lugar del look cargado del tile raster de OpenStreetMap. Los otros estilos
// del mismo host son 'bright' (igual pero más plano) y 'positron' (gris
// minimalista) — se cambian solo tocando esta constante.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Pin propio, como SVG inline: toma el azul de marca vía CSS var y no depende
// de imágenes externas.
const PIN_SVG =
  '<svg width="26" height="35" viewBox="0 0 26 35" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M13 33.5S24.5 21.4 24.5 13A11.5 11.5 0 1 0 1.5 13C1.5 21.4 13 33.5 13 33.5z"' +
  ' fill="var(--br-azul, #1A6FE8)" stroke="#fff" stroke-width="2"/>' +
  '<circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>'

function popupHtml(p: MapPoint) {
  return `
    <div class="br-map-popup">
      ${p.imagen ? `<a href="${escapeHtml(p.href)}"><img src="${escapeHtml(p.imagen)}" alt="" loading="lazy" /></a>` : ''}
      <div class="br-map-popup-body">
        <strong>${escapeHtml(p.titulo)}</strong>
        <span>${escapeHtml(p.subtitulo)}</span>
        <span class="br-map-popup-precio">${escapeHtml(p.precio)}</span>
        <a href="${escapeHtml(p.href)}">${escapeHtml(props.verDetalles)}</a>
      </div>
    </div>
  `
}

function renderMarkers(M: typeof import('maplibre-gl')) {
  if (!map) return
  for (const m of markers) m.remove()
  markers = []
  const bounds = new M.LngLatBounds()
  for (const p of props.points) {
    const lngLat: [number, number] = [p.coords[1], p.coords[0]]
    bounds.extend(lngLat)
    const el = document.createElement('div')
    el.className = 'br-map-pin'
    el.innerHTML = PIN_SVG
    markers.push(
      new M.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(lngLat)
        .setPopup(new M.Popup({ offset: 34, maxWidth: '240px' }).setHTML(popupHtml(p)))
        .addTo(map),
    )
  }
  // Padding generoso y maxZoom bajo a proposito: conviene abrir mostrando de
  // mas y que el usuario acerque, antes que abrir pegado a un grupo de pins
  // con el resto de la ciudad fuera de cuadro.
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 64, maxZoom: 13, animate: false })
  else map.jumpTo({ center: BA_CENTER, zoom: 10.5 })
}

let maplibreMod: typeof import('maplibre-gl') | null = null

async function initMap() {
  const M = await import('maplibre-gl')
  maplibreMod = M
  M.setWorkerUrl(maplibreWorkerUrl)
  if (!mapEl.value) return
  map = new M.Map({
    container: mapEl.value,
    style: MAP_STYLE,
    center: BA_CENTER,
    zoom: 11,
    scrollZoom: false,
    // El style ya declara la atribucion de OpenStreetMap/OpenFreeMap/
    // OpenMapTiles, asi que no se agrega ninguna propia (se duplicaba). En
    // compacto queda como el boton (i) en vez de una barra que cruza el panel.
    attributionControl: { compact: true },
  })
  map.addControl(new M.NavigationControl({ showCompass: false }), 'top-left')
  renderMarkers(M)

  // MapLibre mide el contenedor al crear el mapa y no se entera solo si cambia
  // despues. El panel se muestra recien al tocar "Mapa", asi que al construirlo
  // el alto todavia puede ser el viejo: el canvas quedaba mas chico que el
  // panel y sobraba una banda gris que no se llenaba hasta el primer resize de
  // la ventana. Un rAF suelto no alcanza porque el layout puede seguir
  // acomodandose (fuentes, scrollbar, el sticky). El observer lo remide cada
  // vez que el contenedor cambia de tamano, que es lo unico que importa aca.
  resizeObs = new ResizeObserver(() => map?.resize())
  resizeObs.observe(mapEl.value)
}

onMounted(initMap)
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  resizeObs = null
  map?.remove()
  map = null
  markers = []
})
watch(
  () => props.points,
  () => {
    if (maplibreMod) renderMarkers(maplibreMod)
  },
)
</script>

<template>
  <div ref="mapEl" class="br-map-canvas" role="img" aria-label="Mapa de propiedades"></div>
</template>
