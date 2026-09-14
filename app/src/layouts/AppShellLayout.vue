<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Shared chrome for every authenticated /app/* page (admin/seller/owner).
// Deliberately separate from SiteLayout (the public marketing nav) — this
// is an internal tool, not localized, not part of the public site's i18n.
const authStore = useAuthStore()
const router = useRouter()

async function onLogout() {
  await authStore.logout()
  router.replace({ name: 'app-login' })
}
</script>

<template>
  <div>
    <nav class="navbar navbar-expand-md" style="background: var(--negro, #111)">
      <div class="container">
        <router-link class="navbar-brand" :to="{ name: 'app-dashboard' }">
          <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" height="24" />
        </router-link>
        <div class="d-flex gap-3 align-items-center flex-wrap">
          <template v-if="authStore.role === 'admin'">
            <router-link class="nav-link d-inline text-white" :to="{ name: 'admin-rentals' }">Alquileres</router-link>
            <router-link class="nav-link d-inline text-white" :to="{ name: 'admin-sales' }">Ventas</router-link>
            <router-link class="nav-link d-inline text-white" :to="{ name: 'admin-users' }">Usuarios</router-link>
          </template>
          <template v-else-if="authStore.role === 'seller'">
            <router-link class="nav-link d-inline text-white" :to="{ name: 'seller-listings' }">Mis propiedades</router-link>
            <router-link class="nav-link d-inline text-white" :to="{ name: 'seller-links' }">Links</router-link>
            <router-link class="nav-link d-inline text-white" :to="{ name: 'seller-leads' }">Leads</router-link>
          </template>
          <span v-if="authStore.user" class="text-white-50 small d-none d-md-inline">{{ authStore.user.email }}</span>
          <button class="btn btn-sm btn-outline-light" @click="onLogout">Salir</button>
        </div>
      </div>
    </nav>
    <slot />
  </div>
</template>
