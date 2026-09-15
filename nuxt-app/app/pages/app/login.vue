<script setup lang="ts">
import { signInWithEmailAndPassword } from 'firebase/auth'

// Ported from app/src/pages/app/Login.vue. No `requiresAuth` here — this
// page must render for anyone, signed in or not (a signed-in visitor just
// gets bounced onward below). `layout: false` — AppShellLayout doesn't
// exist yet (N3 scope); the marketing SiteLayout-derived default layout
// doesn't belong on an internal tool page either.
definePageMeta({ layout: false })

// N9 — esta página es `layout: false`, así que NO pasa por app-shell.vue y hay
// que pedirle acá las dos cosas que el resto del panel recibe del layout:
//
//   - br-app.css, que es donde vive el piso de 16px para los inputs. Es la
//     primera pantalla que se abre desde un celular y tiene dos campos: sin
//     eso, iOS Safari hace auto-zoom al tocar el email y deja la página
//     zoomeada para el resto de la sesión.
//   - viewport-fit=cover, por coherencia con el resto del panel.
useHead({
  title: 'BairesRental — Login',
  meta: [
    { name: 'robots', content: 'noindex' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
  ],
  link: [{ rel: 'stylesheet', href: '/css/br-app.css' }],
})

const { t } = useI18n()
const route = useRoute()
const auth = useFirebaseAuth()!
const user = useCurrentUser()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// If a session cookie already resolves to a signed-in user (e.g. visiting
// /app/login directly while already logged in), skip straight past it —
// same behavior as the old onMounted check, but works server-side too
// since `user` is populated by the universal auth plugins, not a
// client-only onAuthStateChanged listener.
watchEffect(() => {
  if (user.value) {
    navigateTo((route.query.redirect as string) || '/app/dashboard')
  }
})

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    // nuxt-vuefire's plugin-mint-cookie.client posts the fresh ID token to
    // /api/__session on the resulting onIdTokenChanged, minting the
    // __session cookie — the watchEffect above then picks up the signed-in
    // user and navigates on.
  } catch {
    error.value = t('app.loginError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- 100dvh y no 100vh: en iOS Safari, 100vh cuenta la barra de direcciones
       como si no estuviera, así que la card quedaba parcialmente tapada. -->
  <main class="br-app br-app-login container d-flex align-items-center justify-content-center" style="min-height: 100dvh">
    <form class="card p-4" style="max-width: 360px; width: 100%" @submit.prevent="onSubmit">
      <h1 class="h5 mb-3 text-center">{{ t('app.loginTitle') }}</h1>

      <div class="mb-2">
        <label class="form-label small" for="email">{{ t('app.email') }}</label>
        <input id="email" v-model="email" type="email" required class="form-control" autocomplete="username" />
      </div>
      <div class="mb-3">
        <label class="form-label small" for="password">{{ t('app.password') }}</label>
        <input id="password" v-model="password" type="password" required class="form-control" autocomplete="current-password" />
      </div>

      <p v-if="error" class="text-danger small">{{ error }}</p>

      <button type="submit" class="btn btn-primary w-100" :disabled="loading">{{ t('app.loginButton') }}</button>
    </form>
  </main>
</template>
