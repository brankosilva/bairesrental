import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router'
import { createI18nInstance } from './i18n'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
  ({ app, router }) => {
    app.use(createPinia())
    const i18n = createI18nInstance()
    app.use(i18n)

    // Keep vue-i18n's active locale in sync with the route being rendered
    // (build time: one render pass per route; runtime: client-side nav
    // between es/en pages) — each route's `meta.locale` is set in
    // src/router/index.ts's route generation.
    router.beforeEach(async (to) => {
      const locale = (to.meta.locale as string) || 'es'
      // @ts-expect-error — i18n.global.locale is a Ref in Composition mode
      i18n.global.locale.value = locale

      // Auth gating is client-only — skipped entirely during the vite-ssg
      // prerender pass (Node has no real Firebase Auth session anyway;
      // /app/* pages just prerender their empty/loading shell, and the
      // real redirect happens here after hydration in the browser).
      if (to.meta.requiresAuth && !import.meta.env.SSR) {
        const { useAuthStore } = await import('./stores/auth')
        const authStore = useAuthStore()
        await authStore.init()
        if (!authStore.user) {
          return { name: 'app-login', query: { redirect: to.fullPath } }
        }
        // UI-level role gate (a convenience redirect, not the real
        // enforcement — Firestore/Storage security rules are what
        // actually protect the data regardless of what this route allows
        // rendering). Anyone signed in but wrongly-placed just bounces to
        // their own dashboard rather than seeing a route they can't use.
        const allowedRoles = to.meta.allowedRoles as string[] | undefined
        if (allowedRoles && !allowedRoles.includes(authStore.role || '')) {
          return { name: 'app-dashboard' }
        }
      }
    })
  },
)
