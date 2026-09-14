<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../../stores/auth'
import { listByOwner } from '../../../data/adminCrud'
import { formatPrice } from '../../../utils/format'
import type { RentalProperty, SaleProperty } from '../../../data/properties'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'

// v1 scope, per docs/negocio.md: read-only status view. No write actions
// (owners don't edit their own listings — that stays with staff/sellers).
useHead({ title: 'BairesRental — Mis propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const authStore = useAuthStore()
const rentals = ref<(RentalProperty & { id: string; updatedAt?: { seconds: number } })[]>([])
const sales = ref<(SaleProperty & { id: string; updatedAt?: { seconds: number } })[]>([])
const loading = ref(true)

onMounted(async () => {
  await authStore.init()
  const uid = authStore.user?.uid
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
  <AppShellLayout>
    <main class="container py-4">
      <h1 class="h4 mb-3">Estado de tus propiedades</h1>

      <p v-if="loading">Cargando…</p>
      <p v-else-if="!rentals.length && !sales.length" class="text-muted">
        Todavía no hay propiedades vinculadas a tu cuenta. Si esto no es correcto, contactá a BairesRental.
      </p>

      <template v-else>
        <div v-for="r in rentals" :key="r.id" class="card mb-2">
          <div class="card-body d-flex justify-content-between flex-wrap gap-2">
            <div>
              <strong>{{ r.titulo }}</strong>
              <div class="small text-muted">{{ r.barrio }} · Alquiler</div>
            </div>
            <div class="text-end">
              <span
                class="badge d-block mb-1"
                :class="{
                  'text-bg-success': r.disponibilidad === 'disponible',
                  'text-bg-warning': r.disponibilidad === 'reservado',
                  'text-bg-secondary': r.disponibilidad === 'no disponible',
                }"
              >
                {{ r.disponibilidad }}
              </span>
              <div class="small">{{ formatPrice(r.precio, r.moneda) }}</div>
              <div class="small text-muted">Actualizado: {{ formatDate(r.updatedAt) }}</div>
            </div>
          </div>
        </div>

        <div v-for="s in sales" :key="s.id" class="card mb-2">
          <div class="card-body d-flex justify-content-between flex-wrap gap-2">
            <div>
              <strong>{{ s.titulo }}</strong>
              <div class="small text-muted">{{ s.barrio }} · Venta</div>
            </div>
            <div class="text-end">
              <span
                class="badge d-block mb-1"
                :class="{
                  'text-bg-success': s.disponibilidad === 'disponible',
                  'text-bg-warning': s.disponibilidad === 'reservado',
                  'text-bg-secondary': s.disponibilidad === 'vendido',
                }"
              >
                {{ s.disponibilidad }}
              </span>
              <div class="small">{{ formatPrice(s.precio, s.moneda) }}</div>
              <div class="small text-muted">Actualizado: {{ formatDate(s.updatedAt) }}</div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </AppShellLayout>
</template>
