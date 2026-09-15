<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Botones flotantes (WhatsApp + Instagram + volver arriba). Portado de
// index.html:1315-1332 + CSS :789-823 — las páginas del catálogo usaban las
// mismas reglas con prefijo `br-` (departamentos.html:385-413), así que acá
// se unifican en un solo componente con los nombres `br-*`, que es la
// convención del resto de la app.
//
// Va montado una sola vez en layouts/default.vue, nunca en app-shell.vue:
// un FAB de WhatsApp no tiene sentido adentro del panel admin.
//
// NUXT-DEVIATION: en el sitio estático las fichas de detalle
// (departamento.html, detalle-venta.html, ficha-vendedor.html) NO tenían
// FABs — solo home, departamentos, ventas, tickets y catalogo-vendedores.
// Al montarlo a nivel layout ahora aparece también en las fichas. Se deja
// así a propósito: un "volver arriba" en una ficha larga suma, y reproducir
// la inconsistencia obligaría a meter plomería de definePageMeta por página.

const props = defineProps<{
  /** Mensaje pre-cargado del WhatsApp. Cada página estática tenía el suyo
   *  (ver index.html vs departamentos.html vs ventas.html vs tickets.html). */
  waMessage?: string
}>()

const DEFAULT_WA_MSG = 'Hola! Quiero información sobre BairesRental.'

const waHref = computed(() => whatsappUrl(props.waMessage || DEFAULT_WA_MSG))

// Solo el estado de visibilidad del botón "volver arriba" es client-side.
// Los tres botones se renderizan en el HTML del servidor; el CSS base de
// .br-top-fab ya es `opacity:0; pointer-events:none`, así que el HTML
// servidor y el cliente pre-hidratación coinciden exactamente y no hay
// hydration mismatch. Mismo patrón que el `scrolled` de layouts/default.vue.
const showTop = ref(false)

function onScroll() {
  showTop.value = window.scrollY > 400
}

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="br-fab-group">
    <button
      class="br-top-fab"
      :class="{ visible: showTop }"
      type="button"
      title="Volver al inicio"
      aria-label="Volver al inicio"
      @click="toTop"
    >
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z" />
      </svg>
    </button>

    <a :href="waHref" target="_blank" rel="noopener" class="br-wa-fab" title="WhatsApp" aria-label="WhatsApp">
      <IconWhatsapp :size="24" />
    </a>

    <a
      href="https://www.instagram.com/bairesrentalok/"
      target="_blank"
      rel="noopener"
      class="br-ig-fab"
      title="Instagram"
      aria-label="Instagram"
    >
      <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z" />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.br-fab-group {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.br-wa-fab,
.br-ig-fab,
.br-top-fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: transform 0.2s, opacity 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.br-wa-fab,
.br-ig-fab {
  background: rgba(20, 20, 24, 0.72);
  color: #fff;
}

.br-wa-fab:hover {
  transform: scale(1.08);
  background: rgba(37, 211, 102, 0.85);
}

.br-ig-fab:hover {
  transform: scale(1.08);
  background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
}

.br-top-fab {
  background: rgba(20, 20, 24, 0.6);
  color: rgba(255, 255, 255, 0.7);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s, transform 0.2s;
}

.br-top-fab.visible {
  opacity: 1;
  pointer-events: auto;
}

.br-top-fab:hover {
  transform: scale(1.08);
  color: #fff;
}
</style>
