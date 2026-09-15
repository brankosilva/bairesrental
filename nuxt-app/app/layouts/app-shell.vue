<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

// Ported from app/src/layouts/AppShellLayout.vue — shared chrome for
// every authenticated /app/* page (admin/seller/owner). Deliberately
// separate from the marketing `default.vue` layout — this is an internal
// tool, not localized, not part of the public site's i18n.
//
// N9 — dos cambios acá:
//
// 1. El rol ya no se resuelve en un onMounted propio. Lo deja listo
//    app/middleware/auth.ts en `useState('app-user-role')`, que corre antes
//    de que este layout renderice y viaja en el payload del SSR. Antes el
//    servidor mandaba el nav sin ningún link.
// 2. El nav era `navbar navbar-expand-md` SIN toggler ni collapse, así que
//    abajo de 768px los links se amontonaban en un flex-wrap. Ahora hay
//    drawer, hecho a mano en Vue calcado de app/layouts/default.vue: el JS de
//    Bootstrap no está cargado en ningún lado de esta app (ni es dependencia),
//    así que `data-bs-toggle` no haría absolutamente nada.
const user = useCurrentUser()
const auth = useFirebaseAuth()!
const role = useState<string | null>('app-user-role', () => null)

useHead({
  // viewport-fit=cover NO viene en el default de Nuxt (es
  // `width=device-width, initial-scale=1`, ver @unhead/bundler/dist/index.mjs),
  // y sin él `env(safe-area-inset-*)` devuelve 0 — o sea que la barra de
  // guardado pegajosa de los formularios quedaría debajo de la barra de gestos
  // del iPhone. Se declara sólo acá y en login.vue, no en nuxt.config.ts:
  // meterlo global cambiaría el encuadre del sitio público.
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
  link: [{ rel: 'stylesheet', href: '/css/br-app.css' }],
})

interface NavLink {
  to: string
  label: string
}

const LINKS_BY_ROLE: Record<string, NavLink[]> = {
  admin: [
    { to: '/app/admin/rentals', label: 'Alquileres' },
    { to: '/app/admin/sales', label: 'Ventas' },
    { to: '/app/admin/users', label: 'Usuarios' },
  ],
  seller: [
    { to: '/app/seller/listings', label: 'Mis propiedades' },
    { to: '/app/seller/links', label: 'Links' },
    { to: '/app/seller/leads', label: 'Leads' },
  ],
  owner: [{ to: '/app/owner', label: 'Mis propiedades' }],
}

const links = computed<NavLink[]>(() => (role.value ? LINKS_BY_ROLE[role.value] ?? [] : []))

const drawerOpen = ref(false)

function closeDrawer() {
  drawerOpen.value = false
}

// Mismo lock que default.vue:69-71. Conviene saber que en iOS Safari
// `overflow: hidden` en el body NO frena el scroll de fondo de forma
// confiable; se mantiene por coherencia con el layout público, no porque
// resuelva el caso del todo.
watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

async function onLogout() {
  closeDrawer()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  // signOut triggers onIdTokenChanged(null), which nuxt-vuefire's
  // plugin-mint-cookie.client posts to /api/__session to clear the
  // __session cookie server-side — same as dashboard.vue's logout.
  role.value = null
  await navigateTo('/app/login')
}
</script>

<template>
  <div class="br-app">
    <nav class="br-app-nav">
      <div class="br-app-nav-inner">
        <NuxtLink class="br-app-brand" to="/app/dashboard">
          <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" height="24" />
        </NuxtLink>

        <div class="br-app-nav-links">
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            class="br-app-nav-link"
            active-class="is-active"
            :to="l.to"
          >
            {{ l.label }}
          </NuxtLink>
        </div>

        <span v-if="user" class="br-app-nav-email">{{ user.email }}</span>
        <button class="btn btn-sm btn-outline-light br-app-nav-logout" @click="onLogout">Salir</button>

        <button
          class="br-app-nav-toggle"
          type="button"
          aria-label="Abrir menú"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          ☰
        </button>
      </div>
    </nav>

    <div class="br-app-drawer-overlay" :class="{ open: drawerOpen }" @click="closeDrawer"></div>

    <div class="br-app-drawer" :class="{ open: drawerOpen }">
      <div class="br-app-drawer-header">
        <span class="br-app-drawer-email">{{ user?.email }}</span>
        <button class="br-app-drawer-close" type="button" aria-label="Cerrar menú" @click="closeDrawer">✕</button>
      </div>

      <ul class="br-app-drawer-links">
        <li v-for="l in links" :key="l.to">
          <NuxtLink class="br-app-drawer-link" active-class="is-active" :to="l.to" @click="closeDrawer">
            {{ l.label }}
          </NuxtLink>
        </li>
      </ul>

      <div class="br-app-drawer-footer">
        <button class="btn btn-outline-secondary w-100" @click="onLogout">Salir</button>
      </div>
    </div>

    <slot />
  </div>
</template>
