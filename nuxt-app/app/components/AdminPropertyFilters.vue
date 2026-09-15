<script setup lang="ts">
import type { PropioFilter } from '~/composables/usePropertyFilters'

// Barra de filtros de las listas del panel (admin/rentals, admin/sales). El
// estado y la lógica viven en usePropertyFilters(); acá está sólo el markup,
// así que las dos pantallas no se van separando con el tiempo.
//
// Incluye el buscador y es la .br-app-toolbar entera —no un bloque que se mete
// adentro— porque los filtros tienen que quedar pegajosos junto con la
// búsqueda: con la lista larga, filtrar y tener que volver al tope para
// cambiar el filtro es el problema que la toolbar sticky ya resolvió para el
// buscador (br-app.css §3).
//
// En mobile los filtros son UNA tira que scrollea en horizontal, no un bloque
// que envuelve: envolviendo, la barra pegajosa se comía media pantalla y la
// lista quedaba mirando por una ranura.
const search = defineModel<string>('search', { required: true })
const tipos = defineModel<string[]>('tipos', { required: true })
const disponibilidad = defineModel<string>('disponibilidad', { required: true })
const propio = defineModel<PropioFilter>('propio', { required: true })

defineProps<{
  /** Tipos presentes en los datos, ya ordenados — ver usePropertyFilters. */
  tipoOptions: string[]
  availabilityOptions: readonly string[]
  /** Cuántos filtros están puestos; 0 esconde el botón de limpiar. */
  activeCount: number
}>()

const emit = defineEmits<{ clear: [] }>()

// Se reemplaza el array en vez de mutarlo: con defineModel, un push no emite
// nada y el padre no se entera del cambio.
function toggleTipo(tipo: string) {
  tipos.value = tipos.value.includes(tipo) ? tipos.value.filter((t) => t !== tipo) : [...tipos.value, tipo]
}
</script>

<template>
  <div class="br-app-toolbar">
    <input v-model="search" type="search" class="form-control" placeholder="Buscar por título, barrio o ID…" />

    <div class="br-app-filters">
      <select v-model="disponibilidad" class="form-select br-app-filter-select" aria-label="Filtrar por disponibilidad">
        <option value="">Disponibilidad: todas</option>
        <option v-for="o in availabilityOptions" :key="o" :value="o">{{ o }}</option>
      </select>

      <select v-model="propio" class="form-select br-app-filter-select" aria-label="Filtrar por gestión">
        <option value="">Gestión: todas</option>
        <option value="si">★ BairesRental</option>
        <option value="no">De terceros</option>
      </select>

      <button
        v-for="tp in tipoOptions"
        :key="tp"
        type="button"
        class="br-app-pill"
        :class="{ active: tipos.includes(tp) }"
        :aria-pressed="tipos.includes(tp)"
        @click="toggleTipo(tp)"
      >
        {{ tp }}
      </button>

      <button v-if="activeCount" type="button" class="br-app-pill br-app-pill-clear" @click="emit('clear')">
        ✕ Limpiar
      </button>
    </div>
  </div>
</template>
