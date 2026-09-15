<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LinkOpenEvent } from '~/types/link'
import { deviceLabel, distinctVisitors, eventDateTime, splitEvents } from '~/composables/useLinkStats'

// El detalle de actividad de un link: quién lo abrió, cuándo y desde dónde.
//
// Está acá y no dentro de seller/links.vue porque desde que el vendedor
// tiene un link personal además de los que genera, la misma lista se
// muestra en dos lugares de esa pantalla — y era el bloque más largo de las
// dos. La carga de los eventos se queda afuera: es la pantalla la que sabe
// cuál está desplegado y no los pide hasta entonces (son N lecturas por
// link y casi siempre se mira uno solo).
const props = defineProps<{
  events: LinkOpenEvent[]
  loading?: boolean
}>()

const showBots = ref(false)
const split = computed(() => splitEvents(props.events))
const visitors = computed(() => distinctVisitors(props.events))

function refererHost(referer: string | null) {
  return referer ? referer.replace(/^https?:\/\//, '').split('/')[0] : ''
}
</script>

<template>
  <div class="br-link-activity">
    <p v-if="loading" class="small text-muted mb-0">Cargando actividad…</p>
    <template v-else>
      <!-- La cifra que importa es "visitantes": una apertura repetida es la
           misma persona volviendo a mirar, no interés nuevo. -->
      <p class="small text-muted mb-2">
        {{ visitors }} {{ visitors === 1 ? 'visitante distinto' : 'visitantes distintos' }}
      </p>
      <ul class="br-link-events">
        <li v-for="(e, i) in split.human" :key="i">
          <span class="br-link-event-when">{{ eventDateTime(e.at) }}</span>
          <span>{{ deviceLabel(e.device) }}</span>
          <span v-if="e.type === 'whatsapp'" class="is-good">tocó contacto</span>
          <span v-else-if="e.referer" class="text-muted">desde {{ refererHost(e.referer) }}</span>
        </li>
        <li v-if="!split.human.length" class="text-muted">Nadie lo abrió todavía.</li>
      </ul>

      <!-- Las vistas previas de las apps no cuentan como aperturas, pero se
           guardan igual: si alguna vez el filtro se come gente real, se ve
           acá en vez de desaparecer. -->
      <p v-if="split.bots.length" class="small text-muted mb-0">
        <button class="btn btn-link btn-sm p-0 align-baseline" @click="showBots = !showBots">
          + {{ split.bots.length }} vista(s) previa(s) de apps
        </button>
        <span v-if="showBots" class="d-block mt-1">
          <span v-for="(e, i) in split.bots" :key="i" class="d-block">
            {{ eventDateTime(e.at) }} · {{ e.botName }}
          </span>
        </span>
      </p>
    </template>
  </div>
</template>
