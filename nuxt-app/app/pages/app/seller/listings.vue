<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { Availability } from '~/utils/availability'

// Ported from app/src/pages/app/seller/Listings.vue — a seller's own
// listings, sellerUid-filtered via listBySeller() (app/utils/adminCrud.ts).
//
// N9: mismas cards que las pantallas de admin, y el vendedor puede marcar
// reservado/no disponible/vendido desde acá sobre SUS propiedades — las
// firestore.rules ya lo permitían (`resource.data.sellerUid == request.auth.uid`),
// no hizo falta tocarlas. Dos instancias de useAvailability porque son dos
// colecciones distintas; los avisos de las dos se muestran en un solo lugar.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const rentals = ref<(RentalProperty & { id: string })[]>([])
const sales = ref<(SaleProperty & { id: string })[]>([])
const loading = ref(true)

const {
  savingId: savingRentalId,
  notice: rentalNotice,
  setAvailability: setRentalAvailability,
} = useAvailability('rentals')

const {
  savingId: savingSaleId,
  notice: saleNotice,
  setAvailability: setSaleAvailability,
} = useAvailability('sales')

const notice = computed(() => rentalNotice.value ?? saleNotice.value)

function clearNotice() {
  rentalNotice.value = null
  saleNotice.value = null
}

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    ;[rentals.value, sales.value] = await Promise.all([
      listBySeller<RentalProperty>('rentals', uid),
      listBySeller<SaleProperty>('sales', uid),
    ])
  }
  loading.value = false
})
</script>

<template>
  <main class="container py-4">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Mis propiedades</h1>
      <div class="d-flex gap-2">
        <NuxtLink to="/app/rentals/new" class="btn btn-primary">+ Alquiler</NuxtLink>
        <NuxtLink to="/app/sales/new" class="btn btn-primary">+ Venta</NuxtLink>
      </div>
    </div>

    <div
      v-if="notice"
      class="alert br-app-notice d-flex align-items-start gap-2 mt-3"
      :class="notice.tone === 'danger' ? 'alert-warning' : 'alert-info'"
      role="alert"
    >
      <div class="small flex-grow-1">{{ notice.text }}</div>
      <button type="button" class="btn-close flex-shrink-0" aria-label="Cerrar" @click="clearNotice"></button>
    </div>

    <p v-if="loading" class="mt-3">Cargando…</p>

    <template v-else>
      <h2 class="h6 text-muted mt-4">Alquileres ({{ rentals.length }})</h2>
      <div v-if="rentals.length" class="br-app-list">
        <PropertyAdminCard
          v-for="r in rentals"
          :id="r.id"
          :key="r.id"
          kind="rental"
          :titulo="r.titulo"
          :barrio="r.barrio"
          :tipo="r.tipo"
          :precio="r.precio"
          :moneda="r.moneda"
          :disponibilidad="r.disponibilidad"
          :thumb="r.imagen"
          :edit-to="`/app/rentals/${r.id}`"
          :saving="savingRentalId === r.id"
          @change="(v: Availability) => setRentalAvailability(r, v)"
        />
      </div>
      <p v-else class="br-app-empty">Todavía no cargaste ningún alquiler.</p>

      <h2 class="h6 text-muted mt-4">Ventas ({{ sales.length }})</h2>
      <div v-if="sales.length" class="br-app-list">
        <PropertyAdminCard
          v-for="s in sales"
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
          :saving="savingSaleId === s.id"
          @change="(v: Availability) => setSaleAvailability(s, v)"
        />
      </div>
      <p v-else class="br-app-empty">Todavía no cargaste ninguna venta.</p>
    </template>
  </main>
</template>
