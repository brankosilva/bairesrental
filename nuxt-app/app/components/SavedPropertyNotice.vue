<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyKind } from '~/utils/availability'

// Cartel verde de "listo, se guardó" arriba de las listas del panel. Lo
// dispara useJustSaved() con lo que dejó el formulario en la query.
//
// El link va a la FICHA PÚBLICA y abre en otra pestaña: después de cargar una
// propiedad lo que se quiere es ver cómo quedó publicada, y sin sacar a nadie
// del panel en medio de una tanda de altas (mismo criterio que el botón de
// ficha de PropertyAdminCard).
// Cuando el que guardó es un vendedor, la propiedad NO quedó publicada: quedó
// esperando que un admin la apruebe. Decirle "ya se publicó" sería mentirle, y
// además lo mandaría a mirar una ficha que le va a contestar 404.
const props = withDefaults(
  defineProps<{
    kind: PropertyKind
    id: string
    titulo?: string
    isNew?: boolean
    enRevision?: boolean
  }>(),
  { titulo: '', isNew: false, enRevision: false },
)

defineEmits<{ close: [] }>()

const fichaTo = computed(() => (props.kind === 'rental' ? `/departamentos/${props.id}` : `/ventas/${props.id}`))
const editTo = computed(() => (props.kind === 'rental' ? `/app/rentals/${props.id}` : `/app/sales/${props.id}`))
</script>

<template>
  <div class="alert br-app-notice" :class="enRevision ? 'alert-info' : 'alert-success'" role="status">
    <div class="d-flex align-items-start gap-2">
      <div class="small flex-grow-1">
        <template v-if="enRevision">
          <strong v-if="isNew">✅ Guardada: «{{ titulo || id }}» quedó en revisión.</strong>
          <strong v-else>✅ Se guardaron los cambios de «{{ titulo || id }}».</strong>
          <div class="mt-1">
            Un admin la revisa antes de que salga al sitio. Mientras tanto la ves acá, primera en esta lista, pero
            todavía no está en el catálogo público.
          </div>
        </template>
        <template v-else>
          <strong v-if="isNew">✅ ¡Listo! Ya se publicó «{{ titulo || id }}».</strong>
          <strong v-else>✅ Se guardaron los cambios de «{{ titulo || id }}».</strong>
          <div class="mt-1">Está online en el catálogo, y primera en esta lista.</div>
        </template>
      </div>
      <button type="button" class="btn-close flex-shrink-0" aria-label="Cerrar" @click="$emit('close')"></button>
    </div>

    <div class="d-flex flex-wrap gap-2 mt-2">
      <!-- Sin el botón de la ficha cuando está en revisión: la página pública
           le contestaría 404 a cualquiera que no esté logueado, y mandar a
           "ver cómo quedó publicada" algo que no se publicó es peor que no
           ofrecer el link. -->
      <a v-if="!enRevision" :href="fichaTo" target="_blank" rel="noopener" class="btn btn-success">
        <i class="bi bi-box-arrow-up-right"></i> Ver la ficha publicada
      </a>
      <NuxtLink :to="editTo" class="btn btn-outline-secondary">Seguir editando</NuxtLink>
    </div>
  </div>
</template>
