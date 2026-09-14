<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../../stores/auth'
import { listBySeller } from '../../../data/adminCrud'
import { formatPrice } from '../../../utils/format'
import type { RentalProperty, SaleProperty } from '../../../data/properties'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'

useHead({ title: 'BairesRental — Mis propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const authStore = useAuthStore()
const rentals = ref<(RentalProperty & { id: string })[]>([])
const sales = ref<(SaleProperty & { id: string })[]>([])
const loading = ref(true)

onMounted(async () => {
  await authStore.init()
  const uid = authStore.user?.uid
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
  <AppShellLayout>
    <main class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 class="h4 mb-0">Mis propiedades</h1>
        <div class="d-flex gap-2">
          <router-link :to="{ name: 'app-rental-form', params: { id: 'new' } }" class="btn btn-primary btn-sm">+ Alquiler</router-link>
          <router-link :to="{ name: 'app-sale-form', params: { id: 'new' } }" class="btn btn-primary btn-sm">+ Venta</router-link>
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
                <td><router-link :to="{ name: 'app-rental-form', params: { id: r.id } }" class="btn btn-sm btn-outline-secondary">Editar</router-link></td>
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
                <td><router-link :to="{ name: 'app-sale-form', params: { id: s.id } }" class="btn btn-sm btn-outline-secondary">Editar</router-link></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-muted small">Todavía no cargaste ninguna venta.</p>
      </template>
    </main>
  </AppShellLayout>
</template>
