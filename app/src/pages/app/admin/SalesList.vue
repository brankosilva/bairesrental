<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { listAll } from '../../../data/adminCrud'
import { formatPrice } from '../../../utils/format'
import type { SaleProperty } from '../../../data/properties'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'

useHead({ title: 'BairesRental — Admin · Ventas', meta: [{ name: 'robots', content: 'noindex' }] })

const sales = ref<(SaleProperty & { id: string; sellerUid?: string | null })[]>([])
const loading = ref(true)
const search = ref('')

onMounted(async () => {
  sales.value = await listAll('sales')
  loading.value = false
})

const filtered = computed(() =>
  sales.value.filter((s) => `${s.titulo} ${s.barrio} ${s.id}`.toLowerCase().includes(search.value.toLowerCase())),
)
</script>

<template>
  <AppShellLayout>
    <main class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h4 mb-0">Ventas ({{ sales.length }})</h1>
        <router-link :to="{ name: 'app-sale-form', params: { id: 'new' } }" class="btn btn-primary">+ Nueva</router-link>
      </div>

      <input v-model="search" type="search" class="form-control mb-3" placeholder="Buscar por título, barrio o ID…" />

      <p v-if="loading">Cargando…</p>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Título</th>
              <th>Barrio</th>
              <th>Disponibilidad</th>
              <th>Precio</th>
              <th>Vendedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id">
              <td>{{ s.titulo }}</td>
              <td>{{ s.barrio }}</td>
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
              <td class="small text-muted">{{ s.sellerUid ? s.sellerUid.slice(0, 8) + '…' : '— (propio)' }}</td>
              <td>
                <router-link :to="{ name: 'app-sale-form', params: { id: s.id } }" class="btn btn-sm btn-outline-secondary">Editar</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </AppShellLayout>
</template>
