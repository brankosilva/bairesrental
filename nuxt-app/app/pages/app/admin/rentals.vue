<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { RentalProperty } from '~/types/property'
import type { Availability } from '~/utils/availability'

// Ported from app/src/pages/app/admin/RentalsList.vue. Plain list +
// client-side search filter, same as the old app — no SEO/crawler reason
// to server-render this (noindex, behind auth), so client-fetch-on-mount
// via listAll() is fine and proportionate (see this milestone's brief).
//
// N9: la tabla de 6 columnas dentro de .table-responsive pasó a ser una lista
// de <PropertyAdminCard>, y la disponibilidad se cambia desde acá sin entrar
// al formulario (useAvailability). El botón de eliminar ya no está en la
// lista: vive dentro del formulario de cada propiedad — ver el comentario del
// componente.
//
// Los filtros (tipo / gestión / disponibilidad) son los mismos que en
// admin/sales: el estado está en usePropertyFilters() y el markup en
// <AdminPropertyFilters>.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Alquileres', meta: [{ name: 'robots', content: 'noindex' }] })

type Row = RentalProperty & { id: string; sellerUid?: string | null }

const rentals = ref<Row[]>([])
const loading = ref(true)

const { savingId, notice, setAvailability } = useAvailability('rentals')
const { search, tipos, disponibilidad, propio, tipoOptions, availabilityOptions, matches, activeCount, clear } =
  usePropertyFilters<Row>('rental', rentals)

onMounted(async () => {
  rentals.value = await listAll('rentals')
  loading.value = false
})

const filtered = computed(() => rentals.value.filter(matches))

function sellerLabel(r: Row): string {
  return r.sellerUid ? `vendedor ${r.sellerUid.slice(0, 8)}…` : 'gestiona BairesRental'
}

// A dónde manda el botón de ficha. Misma precedencia que el mensaje de
// WhatsApp del catálogo público (departamentos/index.vue:202): primero el link
// directo si lo hay (Airbnb, Booking), si no el álbum de ficha.info que se le
// pasa a los colegas. Sin ninguno de los dos queda la ficha del propio sitio,
// que siempre existe — es lo que se manda por WhatsApp igual.
function fichaHref(r: Row): string {
  return r.fichaUrl || r.fotos || `/departamentos/${r.id}`
}
</script>

<template>
  <main class="container py-4">
    <div class="br-app-head">
      <h1 class="h4 mb-0">
        Alquileres ({{ filtered.length
        }}<template v-if="filtered.length !== rentals.length"> de {{ rentals.length }}</template>)
      </h1>
      <NuxtLink to="/app/rentals/new" class="btn btn-primary">+ Nuevo</NuxtLink>
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
          v-for="r in filtered"
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
          :ficha-to="fichaHref(r)"
          :extra="sellerLabel(r)"
          :saving="savingId === r.id"
          @change="(v: Availability) => setAvailability(r, v)"
        />
      </div>

      <p v-else-if="activeCount" class="br-app-empty">Ningún alquiler coincide con los filtros.</p>
      <p v-else class="br-app-empty">Todavía no hay alquileres cargados.</p>
    </template>
  </main>
</template>
