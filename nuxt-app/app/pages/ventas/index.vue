<script setup lang="ts">
import { ref, computed } from 'vue'
import { collection, getFirestore } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import type { SaleProperty } from '~/types/property'

// Ported from app/src/pages/Ventas.vue — getAllSales() replaced by
// useCollection straight against the `sales` collection, same treatment
// as Departamentos.vue.
const { t, locale } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => (locale.value === 'en' ? 'Apartments for sale in Buenos Aires — BairesRental' : 'Departamentos en venta en Buenos Aires — BairesRental'),
  description: () =>
    locale.value === 'en'
      ? 'Verified properties for sale in Buenos Aires, with all the information and photos you need to decide.'
      : 'Propiedades verificadas en venta en Buenos Aires, con toda la información y fotos que necesitás para decidir.',
})

const db = getFirestore()
const salesRef = useCollection<SaleProperty>(collection(db, 'sales'))
// "vendido" listings are kept in the data for internal use but never shown publicly.
const sales = computed(() => (salesRef.value ?? []).filter((s) => s.disponibilidad !== 'vendido'))

const search = ref('')
const barrio = ref('')
const tipo = ref('')
const superficieMin = ref<number | null>(null)
const aptoCredito = ref(false)

const barrios = computed(() => [...new Set(sales.value.map((s) => s.barrio))].sort())
const tipos = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH']

const filtered = computed(() =>
  sales.value.filter((s) => {
    if (search.value && !`${s.titulo} ${s.barrio} ${s.descripcion}`.toLowerCase().includes(search.value.toLowerCase())) return false
    if (barrio.value && s.barrio !== barrio.value) return false
    if (tipo.value && s.tipo !== tipo.value) return false
    if (superficieMin.value && s.superficie < superficieMin.value) return false
    if (aptoCredito.value && !s.aptoCredito) return false
    return true
  }),
)

function clearFilters() {
  search.value = ''
  barrio.value = ''
  tipo.value = ''
  superficieMin.value = null
  aptoCredito.value = false
}
</script>

<template>
  <main class="container py-4">
    <header class="mb-4">
      <p class="text-uppercase text-muted small mb-1">{{ t('ventas.eyebrow') }}</p>
      <h1 class="h3">{{ t('ventas.title') }}</h1>
      <p class="text-muted">{{ t('ventas.subtitle') }}</p>
    </header>

    <div class="br-filtros row g-2 align-items-center mb-4">
      <div class="col-sm-4">
        <input v-model="search" type="search" class="form-control" :placeholder="t('ventas.searchPlaceholder')" />
      </div>
      <div class="col-sm-3">
        <select v-model="barrio" class="form-select">
          <option value="">{{ t('ventas.allBarrios') }}</option>
          <option v-for="b in barrios" :key="b" :value="b">{{ b }}</option>
        </select>
      </div>
      <div class="col-sm-3">
        <select v-model="tipo" class="form-select">
          <option value="">{{ t('ventas.allTipos') }}</option>
          <option v-for="tp in tipos" :key="tp" :value="tp">{{ tp }}</option>
        </select>
      </div>
      <div class="col-sm-2 form-check form-switch">
        <input id="apto-credito" v-model="aptoCredito" class="form-check-input" type="checkbox" />
        <label class="form-check-label" for="apto-credito">{{ t('ventas.aptoCredito') }}</label>
      </div>
    </div>

    <p class="text-muted">
      {{ t('ventas.resultCount', { count: filtered.length }, filtered.length) }}
      <button v-if="search || barrio || tipo || superficieMin || aptoCredito" class="btn btn-link btn-sm" @click="clearFilters">
        {{ t('ventas.clearFilters') }}
      </button>
    </p>

    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
      <div v-for="s in filtered" :key="s.id" class="col">
        <NuxtLink :to="localePath(`/ventas/${s.id}`)" class="br-prop-card card h-100 text-decoration-none text-body">
          <img v-if="s.fotos?.[0]" :src="s.fotos[0]" :alt="s.titulo" class="card-img-top" style="height: 210px; object-fit: cover" />
          <div v-else class="card-img-top d-flex align-items-center justify-content-center" style="height: 210px; background: var(--gris, #f4f4f6)">📸</div>
          <div class="card-body">
            <span
              class="badge mb-1"
              :class="{
                'text-bg-success': s.disponibilidad === 'disponible',
                'text-bg-warning': s.disponibilidad === 'reservado',
              }"
            >
              {{ t(`disponibilidad.${s.disponibilidad}`) }}
            </span>
            <span v-if="s.esPropio" class="badge text-bg-primary mb-1 ms-1">★</span>
            <h2 class="h6 card-title mt-1">{{ s.titulo }}</h2>
            <p class="text-muted small mb-1">{{ s.barrio }} · {{ s.tipo }} · {{ s.superficie }} m²</p>
            <p class="fw-semibold mb-0">{{ formatPrice(s.precio, s.moneda) }}</p>
          </div>
        </NuxtLink>
      </div>
    </div>

    <p v-if="!filtered.length" class="text-center text-muted py-5">{{ t('ventas.noResults') }}</p>
  </main>
</template>
