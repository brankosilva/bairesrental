<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'

// Ported from app/src/pages/app/seller/Listings.vue — a seller's own
// listings, sellerUid-filtered via listBySeller() (app/utils/adminCrud.ts).
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const rentals = ref<(RentalProperty & { id: string })[]>([])
const sales = ref<(SaleProperty & { id: string })[]>([])
const loading = ref(true)

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
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h1 class="h4 mb-0">Mis propiedades</h1>
      <div class="d-flex gap-2">
        <NuxtLink to="/app/rentals/new" class="btn btn-primary btn-sm">+ Alquiler</NuxtLink>
        <NuxtLink to="/app/sales/new" class="btn btn-primary btn-sm">+ Venta</NuxtLink>
      </div>
    </div>

    <p v-if="loading">Cargando…</p>
    <template v-else>
      <h2 class="h6 text-muted mt-4">Alquileres ({{ rentals.length }})</h2>
      <div v-if="rentals.length" class="table-responsive mb-4">
        <table class="table table-sm align-middle">
          <tbody>
            <tr v-for="r in rentals" :key="r.id">
              <td>{{ r.titulo }}</td>
              <td class="text-muted small">{{ r.barrio }}</td>
              <td><span class="badge text-bg-light border">{{ r.disponibilidad }}</span></td>
              <td>{{ formatPrice(r.precio, r.moneda) }}</td>
              <td><NuxtLink :to="`/app/rentals/${r.id}`" class="btn btn-sm btn-outline-secondary">Editar</NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-muted small">Todavía no cargaste ningún alquiler.</p>

      <h2 class="h6 text-muted mt-4">Ventas ({{ sales.length }})</h2>
      <div v-if="sales.length" class="table-responsive">
        <table class="table table-sm align-middle">
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>{{ s.titulo }}</td>
              <td class="text-muted small">{{ s.barrio }}</td>
              <td><span class="badge text-bg-light border">{{ s.disponibilidad }}</span></td>
              <td>{{ formatPrice(s.precio, s.moneda) }}</td>
              <td><NuxtLink :to="`/app/sales/${s.id}`" class="btn btn-sm btn-outline-secondary">Editar</NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-muted small">Todavía no cargaste ninguna venta.</p>
    </template>
  </main>
</template>
