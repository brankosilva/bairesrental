<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Ported from app/src/layouts/AppShellLayout.vue — shared chrome for
// every authenticated /app/* page (admin/seller/owner). Deliberately
// separate from the marketing `default.vue` layout — this is an internal
// tool, not localized, not part of the public site's i18n.
const user = useCurrentUser()
const role = ref<string | null>(null)
const auth = useFirebaseAuth()!

onMounted(async () => {
  role.value = await fetchUserRole()
})

async function onLogout() {
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  // signOut triggers onIdTokenChanged(null), which nuxt-vuefire's
  // plugin-mint-cookie.client posts to /api/__session to clear the
  // __session cookie server-side — same as dashboard.vue's logout.
  await navigateTo('/app/login')
}
</script>

<template>
  <div>
    <nav class="navbar navbar-expand-md" style="background: var(--negro, #111)">
      <div class="container">
        <NuxtLink class="navbar-brand" to="/app/dashboard">
          <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" height="24" />
        </NuxtLink>
        <div class="d-flex gap-3 align-items-center flex-wrap">
          <template v-if="role === 'admin'">
            <NuxtLink class="nav-link d-inline text-white" to="/app/admin/rentals">Alquileres</NuxtLink>
            <NuxtLink class="nav-link d-inline text-white" to="/app/admin/sales">Ventas</NuxtLink>
            <NuxtLink class="nav-link d-inline text-white" to="/app/admin/users">Usuarios</NuxtLink>
          </template>
          <template v-else-if="role === 'seller'">
            <NuxtLink class="nav-link d-inline text-white" to="/app/seller/listings">Mis propiedades</NuxtLink>
            <NuxtLink class="nav-link d-inline text-white" to="/app/seller/links">Links</NuxtLink>
            <NuxtLink class="nav-link d-inline text-white" to="/app/seller/leads">Leads</NuxtLink>
          </template>
          <template v-else-if="role === 'owner'">
            <NuxtLink class="nav-link d-inline text-white" to="/app/owner">Mis propiedades</NuxtLink>
          </template>
          <span v-if="user" class="text-white-50 small d-none d-md-inline">{{ user.email }}</span>
          <button class="btn btn-sm btn-outline-light" @click="onLogout">Salir</button>
        </div>
      </div>
    </nav>
    <slot />
  </div>
</template>
