<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { RentalProperty } from '~/types/property'

// Ported from app/src/pages/app/admin/RentalsList.vue. Plain list +
// client-side search filter, same as the old app — no SEO/crawler reason
// to server-render this (noindex, behind auth), so client-fetch-on-mount
// via listAll() is fine and proportionate (see this milestone's brief).
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Alquileres', meta: [{ name: 'robots', content: 'noindex' }] })

const rentals = ref<(RentalProperty & { id: string; sellerUid?: string | null })[]>([])
const loading = ref(true)
const search = ref('')

onMounted(async () => {
  rentals.value = await listAll('rentals')
  loading.value = false
})

const filtered = computed(() =>
  rentals.value.filter((r) => `${r.titulo} ${r.barrio} ${r.id}`.toLowerCase().includes(search.value.toLowerCase())),
)
</script>

<template>
  <main class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h4 mb-0">Alquileres ({{ rentals.length }})</h1>
      <NuxtLink to="/app/rentals/new" class="btn btn-primary">+ Nuevo</NuxtLink>
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
          <tr v-for="r in filtered" :key="r.id">
            <td>{{ r.titulo }}</td>
            <td>{{ r.barrio }}</td>
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
            <td class="small text-muted">{{ r.sellerUid ? r.sellerUid.slice(0, 8) + '…' : '— (propio)' }}</td>
            <td>
              <NuxtLink :to="`/app/rentals/${r.id}`" class="btn btn-sm btn-outline-secondary">Editar</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
