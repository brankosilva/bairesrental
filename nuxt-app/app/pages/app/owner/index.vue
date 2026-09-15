<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'

// Ported from app/src/pages/app/owner/OwnerDashboard.vue. v1 scope, per
// docs/negocio.md: read-only status view, ownerUid-filtered. No write
// actions — owners don't edit their own listings, that stays with
// staff/sellers. Route is /app/owner (not /app/owner/dashboard), matching
// the old app's router.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['owner'] })
useHead({ title: 'BairesRental — Mis propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const rentals = ref<(RentalProperty & { id: string; updatedAt?: { seconds: number } })[]>([])
const sales = ref<(SaleProperty & { id: string; updatedAt?: { seconds: number } })[]>([])
const loading = ref(true)

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    ;[rentals.value, sales.value] = await Promise.all([
      listByOwner<RentalProperty>('rentals', uid),
      listByOwner<SaleProperty>('sales', uid),
    ])
  }
  loading.value = false
})

function formatDate(ts?: { seconds: number }) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('es-AR')
}
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Estado de tus propiedades</h1>

    <p v-if="loading">Cargando…</p>
    <p v-else-if="!rentals.length && !sales.length" class="text-muted">
      Todavía no hay propiedades vinculadas a tu cuenta. Si esto no es correcto, contactá a BairesRental.
    </p>

    <template v-else>
      <h2 v-if="rentals.length" class="h6 text-muted mt-4">Alquileres ({{ rentals.length }})</h2>
      <div v-if="rentals.length" class="table-responsive mb-4">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Título</th>
              <th>Barrio</th>
              <th>Disponibilidad</th>
              <th>Precio</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rentals" :key="r.id">
              <td>{{ r.titulo }}</td>
              <td class="text-muted small">{{ r.barrio }}</td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'text-bg-success': r.disponibilidad === 'disponible',
                    'text-bg-warning': r.disponibilidad === 'reservado',
                    'text-bg-secondary': r.disponibilidad === 'no disponible',
                  }"
                >
                  {{ r.disponibilidad }}
                </span>
              </td>
              <td>{{ formatPrice(r.precio, r.moneda) }}</td>
              <td class="small text-muted">{{ formatDate(r.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 v-if="sales.length" class="h6 text-muted mt-4">Ventas ({{ sales.length }})</h2>
      <div v-if="sales.length" class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Título</th>
              <th>Barrio</th>
              <th>Disponibilidad</th>
              <th>Precio</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>{{ s.titulo }}</td>
              <td class="text-muted small">{{ s.barrio }}</td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'text-bg-success': s.disponibilidad === 'disponible',
                    'text-bg-warning': s.disponibilidad === 'reservado',
                    'text-bg-secondary': s.disponibilidad === 'vendido',
                  }"
                >
                  {{ s.disponibilidad }}
                </span>
              </td>
              <td>{{ formatPrice(s.precio, s.moneda) }}</td>
              <td class="small text-muted">{{ formatDate(s.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </main>
</template>
