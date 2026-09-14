<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../stores/auth'

useHead({ title: 'BairesRental — Login', meta: [{ name: 'robots', content: 'noindex' }] })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

onMounted(async () => {
  await authStore.init()
  if (authStore.user) {
    router.replace((route.query.redirect as string) || { name: 'app-dashboard' })
  }
})

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.replace((route.query.redirect as string) || { name: 'app-dashboard' })
  } catch {
    error.value = t('app.loginError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="container d-flex align-items-center justify-content-center" style="min-height: 80vh">
    <form class="card p-4" style="max-width: 360px; width: 100%" @submit.prevent="onSubmit">
      <img src="/images/bairesrental-high-resolution-logo.png" alt="BairesRental" height="32" class="mb-3 mx-auto" />
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
