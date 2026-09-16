<script setup lang="ts">
import type { EstadoRevision } from '~/utils/revision'

// El cartel de estado arriba del formulario de una propiedad.
//
// Lo comparten el formulario de alquileres y el de ventas, que son dos
// archivos casi gemelos: cualquier cosa que aparezca en los dos va en un
// componente o termina divergiendo (ya pasó con los campos de ubicación, ver
// PropertyLocationFields.vue).
//
// El motivo del rechazo se muestra SÓLO cuando revision == 'rechazada'. No es
// cosmético: el vendedor no puede limpiar el campo (firestore.rules se lo
// prohíbe, para que el admin conserve el historial), así que el texto sigue en
// el documento después de que lo corrigió. Mostrarlo en 'pendiente' dejaría un
// reproche viejo colgado sobre una propiedad ya arreglada.
withDefaults(
  defineProps<{
    revision: EstadoRevision
    motivoRechazo?: string | null
    isAdmin?: boolean
  }>(),
  { motivoRechazo: null, isAdmin: false },
)
</script>

<template>
  <div v-if="revision === 'rechazada'" class="alert alert-warning br-app-notice" role="alert">
    <strong class="d-block mb-1">Rechazada</strong>
    <p v-if="motivoRechazo" class="mb-1 small">{{ motivoRechazo }}</p>
    <p class="mb-0 small text-muted">
      <template v-if="isAdmin">El vendedor ve este motivo en su panel. Cuando la corrija, vuelve a la cola.</template>
      <template v-else>Corregí lo que dice acá y guardá: vuelve a revisión y un admin la mira de nuevo.</template>
    </p>
  </div>

  <div v-else-if="revision === 'pendiente'" class="alert alert-info br-app-notice" role="alert">
    <strong class="d-block mb-1">En revisión</strong>
    <p class="mb-0 small text-muted">
      <template v-if="isAdmin">
        Todavía no está publicada. Podés aprobarla desde
        <NuxtLink to="/app/admin/revision">Revisión</NuxtLink>.
      </template>
      <template v-else>
        Todavía no está en el sitio. Un admin la revisa y, si está todo bien, la publica. Si la editás, sigue en
        revisión.
      </template>
    </p>
  </div>
</template>
