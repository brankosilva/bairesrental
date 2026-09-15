<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { SaleProperty } from '~/types/property'
import type { Availability } from '~/utils/availability'

// Ported from app/src/pages/app/admin/SalesList.vue — see rentals.vue's
// sibling comment for why client-fetch-on-mount is fine here, y para el
// cambio de N9 (cards + disponibilidad desde la lista, sin botón de eliminar).
// Los filtros son los mismos que allá — usePropertyFilters() +
// <AdminPropertyFilters>.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Ventas', meta: [{ name: 'robots', content: 'noindex' }] })

type Row = SaleProperty & { id: string; sellerUid?: string | null }

const sales = ref<Row[]>([])
const loading = ref(true)

const { savingId, notice, setAvailability } = useAvailability('sales')
const { search, tipos, disponibilidad, propio, tipoOptions, availabilityOptions, matches, activeCount, clear } =
  usePropertyFilters<Row>('sale', sales)

onMounted(async () => {
  sales.value = await listAll('sales')
  loading.value = false
})

const filtered = computed(() => sales.value.filter(matches))

function sellerLabel(s: Row): string {
  return s.sellerUid ? `vendedor ${s.sellerUid.slice(0, 8)}…` : 'gestiona BairesRental'
}

// A dónde manda el botón de ficha. Acá NO se usa `fotos` como en alquileres:
// en ventas es un string[] de URLs de Storage (la galería nativa de la ficha),
// así que apuntarle abriría una imagen suelta. La ficha con las fotos es la
// pública del sitio; `fichaUrl` (Zonaprop, Argenprop) tiene prioridad cuando
// está, igual que en la ficha pública.
function fichaHref(s: Row): string {
  return s.fichaUrl || `/ventas/${s.id}`
}
</script>

<template>
  <main class="container py-4">
    <div class="br-app-head">
      <h1 class="h4 mb-0">
        Ventas ({{ filtered.length }}<template v-if="filtered.length !== sales.length"> de {{ sales.length }}</template>)
      </h1>
      <NuxtLink to="/app/sales/new" class="btn btn-primary">+ Nueva</NuxtLink>
    </div>

    <AdminPropertyFilters
      v-model:search="search"
      v-model:tipos="tipos"
      v-model:disponibilidad="disponibilidad"
      v-model:propio="propio"
      :tipo-options="tipoOptions"
      :availability-options="availabilityOptions"
      :active-count="activeCount"
      @clear="clear"
    />

    <div
      v-if="notice"
      class="alert br-app-notice d-flex align-items-start gap-2"
      :class="notice.tone === 'danger' ? 'alert-warning' : 'alert-info'"
      role="alert"
    >
      <div class="small flex-grow-1">{{ notice.text }}</div>
      <button type="button" class="btn-close flex-shrink-0" aria-label="Cerrar" @click="notice = null"></button>
    </div>

    <p v-if="loading">Cargando…</p>

    <template v-else>
      <div v-if="filtered.length" class="br-app-list">
        <PropertyAdminCard
          v-for="s in filtered"
          :id="s.id"
          :key="s.id"
          kind="sale"
          :titulo="s.titulo"
          :barrio="s.barrio"
          :tipo="s.tipo"
          :precio="s.precio"
          :moneda="s.moneda"
          :disponibilidad="s.disponibilidad"
          :thumb="s.fotos?.[0] || ''"
          :edit-to="`/app/sales/${s.id}`"
          :ficha-to="fichaHref(s)"
          :extra="sellerLabel(s)"
          :saving="savingId === s.id"
          @change="(v: Availability) => setAvailability(s, v)"
        />
      </div>

      <p v-else-if="activeCount" class="br-app-empty">Ninguna venta coincide con los filtros.</p>
      <p v-else class="br-app-empty">Todavía no hay ventas cargadas.</p>
    </template>
  </main>
</template>
