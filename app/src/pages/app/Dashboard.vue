<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../stores/auth'
import AppShellLayout from '../../layouts/AppShellLayout.vue'

// Acts as a role-aware landing page: signed-in users get bounced straight
// to their own app section. Only visible, on its own, to a signed-in user
// with no role yet assigned (freshly created via onUserCreate, waiting on
// an admin to call setUserRole) — see app/CHANGELOG.md's M4 entry.
useHead({ title: 'BairesRental — Panel', meta: [{ name: 'robots', content: 'noindex' }] })

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const ROLE_HOME: Record<string, string> = {
  admin: 'admin-rentals',
  seller: 'seller-listings',
  owner: 'owner-dashboard',
}

onMounted(async () => {
  await authStore.init()
  if (!authStore.user) {
    router.replace({ name: 'app-login' })
    return
  }
  const home = authStore.role ? ROLE_HOME[authStore.role] : null
  if (home) router.replace({ name: home })
})

async function onLogout() {
  await authStore.logout()
  router.replace({ name: 'app-login' })
}
</script>

<template>
  <AppShellLayout>
    <main v-if="authStore.user" class="container py-4" style="max-width: 480px">
      <h1 class="h4 mb-3">{{ t('app.dashboardTitle') }}</h1>
      <p>{{ t('app.loggedInAs', { email: authStore.user.email }) }}</p>
      <p>
        {{ t('app.role') }}:
        <strong>{{ authStore.role || t('app.roleNone') }}</strong>
      </p>
      <button class="btn btn-outline-secondary" @click="onLogout">{{ t('app.logout') }}</button>
    </main>
  </AppShellLayout>
</template>
