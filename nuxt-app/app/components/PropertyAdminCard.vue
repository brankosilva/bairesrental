<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AVAILABILITY_OPTIONS, availabilityClass, type Availability, type PropertyKind } from '~/utils/availability'

// Fila de propiedad del panel (N9). Reemplaza las tablas de 5-6 columnas
// dentro de .table-responsive que usaban admin/rentals, admin/sales,
// seller/listings y owner/index — en un celular eran scroll horizontal.
//
// Es UN solo árbol de markup para todos los anchos: el CSS (br-app.css §4) lo
// arma como grid con columnas reales arriba de 768px, así se conserva la
// alineación que hace falta para escanear ~80 filas, y lo compacta en dos
// filas abajo. No hay dos markups paralelos que mantener.
//
// PROPS COMO VIEW-MODEL ANGOSTO, no `RentalProperty | SaleProperty`: `fotos`
// significa cosas distintas en cada tipo (en alquileres es un string con la
// URL del álbum; en ventas es un string[] de hasta 20 fotos), así que la
// portada la resuelve la página que usa el componente y acá entra ya resuelta
// como `thumb`.
//
// NO tiene botón de eliminar, a propósito. Con targets de 44px y una miniatura
// al lado, "Eliminar" pegado a "Editar" es el mis-tap garantizado; el borrado
// sigue existiendo dentro de cada formulario, un toque más adentro.
const props = withDefaults(
  defineProps<{
    kind: PropertyKind
    id: string
    titulo: string
    barrio: string
    tipo: string
    precio: number
    moneda: string
    disponibilidad: Availability
    thumb?: string
    /** Ruta del formulario de edición. Vacía = sin acción de editar. */
    editTo?: string
    /** Link a la ficha con las fotos (externa o pública). Vacío = sin botón.
        Lo resuelve la página: qué es "la ficha" depende de la colección. */
    fichaTo?: string
    /** Ruta interna para generar un link con la marca del vendedor. Vacía = sin
        botón.

        LA COLUMNA DE ACCIONES ENTRA DOS BOTONES (94px, ver br-app.css §4), así
        que una misma lista usa `fichaTo` o `shareTo`, no los dos: el tercero se
        sale de la grilla en desktop. */
    shareTo?: string
    /** Línea accesoria: vendedor asignado (admin) o fecha de actualización (dueño). */
    extra?: string
    /** Portal del dueño: chip estático en vez de <select>, y sin acciones. */
    readonly?: boolean
    /** Sólo congela la disponibilidad, pero deja las acciones. Es el caso del
        vendedor mirando una propiedad de BairesRental: la puede compartir, y
        `firestore.rules` le rechazaría el update igual — mejor no ofrecer un
        <select> que va a fallar. */
    statusReadonly?: boolean
    saving?: boolean
  }>(),
  { thumb: '', editTo: '', fichaTo: '', shareTo: '', extra: '', readonly: false, statusReadonly: false, saving: false },
)

const emit = defineEmits<{ change: [value: Availability] }>()

const selectEl = ref<HTMLSelectElement | null>(null)
const options = computed(() => AVAILABILITY_OPTIONS[props.kind])

// Valor elegido que todavía se está guardando.
//
// Sin esto, el <select> PARPADEA HACIA ATRÁS mientras guarda: al elegir una
// opción, el padre pone `saving` en true, eso dispara un re-render, y como el
// prop `disponibilidad` todavía no cambió, Vue repinta el <select> con el valor
// viejo. O sea que el usuario ve volver atrás su propia elección durante todo
// lo que dure la escritura — en datos móviles, un par de segundos en los que
// parece que el toque no registró (y se vuelve a tocar).
const pending = ref<Availability | null>(null)

// Lo que se muestra: mientras guarda, lo elegido; el resto del tiempo, la
// verdad que tiene el padre.
const shown = computed(() => (props.saving && pending.value ? pending.value : props.disponibilidad))
const statusClass = computed(() => availabilityClass(shown.value))

// Al terminar la escritura se suelta el valor pendiente y el <select> vuelve a
// reflejar `disponibilidad` — que si falló sigue siendo el valor viejo.
//
// La reposición explícita del valor del DOM es un cinturón además del
// tirador: el hazard de fondo es que con `:value` + @change, si el valor del
// vnode no cambia Vue NO repinta el <select>, y queda mostrando una opción que
// nunca se guardó. Es un bug real, no teórico — seller/leads.vue tenía
// exactamente este patrón.
watch(
  () => props.saving,
  (now, before) => {
    if (before && !now) {
      pending.value = null
      if (selectEl.value && selectEl.value.value !== props.disponibilidad) {
        selectEl.value.value = props.disponibilidad
      }
    }
  },
)

function onChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as Availability
  pending.value = value
  emit('change', value)
}
</script>

<template>
  <div class="br-app-card" :class="{ 'is-readonly': readonly, 'is-saving': saving }">
    <div class="br-app-card-thumb">
      <img v-if="thumb" :src="thumb" :alt="titulo" loading="lazy" />
      <span v-else aria-hidden="true">📸</span>
    </div>

    <div class="br-app-card-info">
      <div class="br-app-card-titulo">{{ titulo }}</div>
      <div class="br-app-card-meta">{{ barrio }} · {{ tipo }}</div>
      <div class="br-app-card-id">{{ id }}<template v-if="extra"> · {{ extra }}</template></div>
    </div>

    <div class="br-app-card-price">{{ formatPrice(precio, moneda) }}</div>

    <div class="br-app-card-status">
      <span v-if="readonly || statusReadonly" class="br-app-status-tag" :class="statusClass">{{ disponibilidad }}</span>
      <select
        v-else
        ref="selectEl"
        class="form-select br-app-status"
        :class="statusClass"
        :value="shown"
        :disabled="saving"
        :aria-label="`Disponibilidad de ${titulo}`"
        @change="onChange"
      >
        <option v-for="o in options" :key="o" :value="o">{{ o }}</option>
      </select>
    </div>

    <div v-if="!readonly" class="br-app-card-actions">
      <!-- <a> y no <NuxtLink>: la mayoría de las veces apunta afuera del sitio
           (ficha.info, Airbnb, Booking) y siempre abre en otra pestaña, para no
           sacar a nadie del panel en medio de una tanda de ediciones. -->
      <a
        v-if="fichaTo"
        :href="fichaTo"
        target="_blank"
        rel="noopener"
        class="btn btn-outline-secondary br-app-icon-btn"
        :aria-label="`Ver la ficha de ${titulo}`"
        title="Ver ficha"
      >
        <i class="bi bi-box-arrow-up-right"></i>
      </a>
      <NuxtLink
        v-if="shareTo"
        :to="shareTo"
        class="btn btn-outline-secondary br-app-icon-btn"
        :aria-label="`Generar un link de ${titulo}`"
        title="Compartir con mi marca"
      >
        <i class="bi bi-link-45deg"></i>
      </NuxtLink>
      <NuxtLink
        v-if="editTo"
        :to="editTo"
        class="btn btn-outline-secondary br-app-icon-btn"
        :aria-label="`Editar ${titulo}`"
        title="Editar"
      >
        <i class="bi bi-pencil"></i>
      </NuxtLink>
    </div>
  </div>
</template>
