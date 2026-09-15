<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'

// Ported from app/src/pages/app/owner/OwnerDashboard.vue. v1 scope, per
// docs/negocio.md: read-only status view, ownerUid-filtered. No write
// actions — owners don't edit their own listings, that stays with
// staff/sellers. Route is /app/owner (not /app/owner/dashboard), matching
// the old app's router.
//
// N9: mismas cards que el resto del panel, en su variante `readonly` (chip
// estático en vez de <select>, sin botón de editar).
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

// `updatedAt` lo empezó a escribir saveOne() en N9. Las propiedades que no se
// volvieron a guardar desde entonces no lo tienen todavía, así que acá no se
// muestra nada en vez de un "—" sin explicación.
function updatedLabel(ts?: { seconds: number }): string {
  if (!ts?.seconds) return ''
  return `actualizado el ${new Date(ts.seconds * 1000).toLocaleDateString('es-AR')}`
}
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Estado de tus propiedades</h1>

    <p v-if="loading">Cargando…</p>
    <p v-else-if="!rentals.length && !sales.length" class="br-app-empty">
      Todavía no hay propiedades vinculadas a tu cuenta. Si esto no es correcto, contactá a BairesRental.
    </p>

    <template v-else>
      <h2 v-if="rentals.length" class="h6 text-muted mt-4">Alquileres ({{ rentals.length }})</h2>
      <div v-if="rentals.length" class="br-app-list">
        <PropertyAdminCard
          v-for="r in rentals"
          :id="r.id"
          :key="r.id"
          kind="rental"
          readonly
          :titulo="r.titulo"
          :barrio="r.barrio"
          :tipo="r.tipo"
          :precio="r.precio"
          :moneda="r.moneda"
          :disponibilidad="r.disponibilidad"
          :thumb="r.imagen"
          :extra="updatedLabel(r.updatedAt)"
        />
      </div>

      <h2 v-if="sales.length" class="h6 text-muted mt-4">Ventas ({{ sales.length }})</h2>
      <div v-if="sales.length" class="br-app-list">
        <PropertyAdminCard
          v-for="s in sales"
          :id="s.id"
          :key="s.id"
          kind="sale"
          readonly
          :titulo="s.titulo"
          :barrio="s.barrio"
          :tipo="s.tipo"
          :precio="s.precio"
          :moneda="s.moneda"
          :disponibilidad="s.disponibilidad"
          :thumb="s.fotos?.[0] || ''"
          :extra="updatedLabel(s.updatedAt)"
        />
      </div>
    </template>
  </main>
</template>
