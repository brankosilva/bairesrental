<script setup lang="ts">
// Role-aware landing page — ported from app/src/pages/app/Dashboard.vue.
// N3 lands the real admin/seller/owner areas, so this now does the real
// ROLE_HOME redirect the old app did: signed-in users get bounced straight
// to their own app section, and this page's own markup below is only ever
// seen by a signed-in user with no role yet assigned (freshly created via
// onUserCreate, waiting on an admin to call setUserRole) — see
// app/CHANGELOG.md's M4 entry.
//
// `requiresAuth: true` with no `allowedRoles` — any signed-in user, any
// role (including none yet), may land here. This is also still the page
// N2's verification curls against with/without a session cookie.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true })

useHead({ title: 'BairesRental — Panel', meta: [{ name: 'robots', content: 'noindex' }] })

const { t } = useI18n()
const user = useCurrentUser()

const ROLE_HOME: Record<string, string> = {
  admin: '/app/admin/rentals',
  seller: '/app/seller/listings',
  owner: '/app/owner',
}

// El rol sale de los custom claims del ID token, misma fuente de verdad que el
// middleware de auth (nunca una lectura de un doc de Firestore).
//
// N9: antes esta página hacía su propio `useAsyncData` + `getIdTokenResult()`.
// Ahora lo publica app/middleware/auth.ts, que ya leía el token igual y corre
// antes que esta página — una lectura menos, y el mismo valor que ve el nav
// del layout.
const role = useState<string | null>('app-user-role', () => null)

if (role.value && ROLE_HOME[role.value]) {
  await navigateTo(ROLE_HOME[role.value])
}

const auth = useFirebaseAuth()!

async function onLogout() {
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  // signOut triggers onIdTokenChanged(null), which nuxt-vuefire's
  // plugin-mint-cookie.client posts to /api/__session to clear the
  // __session cookie server-side (see api.session-verification.js).
  await navigateTo('/app/login')
}
</script>

<template>
  <main v-if="user" class="container py-4" style="max-width: 480px">
    <h1 class="h4 mb-3">{{ t('app.dashboardTitle') }}</h1>
    <p>{{ t('app.loggedInAs', { email: user.email }) }}</p>
    <p>
      {{ t('app.role') }}:
      <strong>{{ role || t('app.roleNone') }}</strong>
    </p>
    <button class="btn btn-outline-secondary" @click="onLogout">{{ t('app.logout') }}</button>
  </main>
</template>
