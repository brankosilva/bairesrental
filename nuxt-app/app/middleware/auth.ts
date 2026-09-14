// Real, server-enforced replacement for app/src/main.ts's client-only
// `router.beforeEach` guard (that guard's comment literally read
// `if (to.meta.requiresAuth && !import.meta.env.SSR)` — auth was skipped
// entirely during prerendering). This middleware runs universally (server
// AND client, since it isn't suffixed `.client`/`.server`), so an
// unauthenticated request for a protected page gets redirected *before any
// protected content is ever sent* — the whole point of N2.
//
// `getCurrentUser()` (from nuxt-vuefire, wrapping vuefire's own) resolves
// once the auth plugin chain has settled: server-side that means after
// `auth/plugin-user-token.server` decodes the `__session` cookie (if any)
// and `auth/plugin-authenticate-user.server` signs the admin SDK's decoded
// user back into the client Auth SDK via a custom token — confirmed via
// nuxt-vuefire's own runtime source (node_modules/nuxt-vuefire/dist/runtime),
// not assumed from docs alone.
//
// Role comes from ID token custom claims (`role: 'admin' | 'seller' |
// 'owner'`), exactly like the old app/src/stores/auth.ts — set by the
// already-deployed `setUserRole`/`onUserCreate` Cloud Functions, never read
// from a Firestore doc.
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta.requiresAuth) return

  const user = await getCurrentUser()

  if (!user) {
    return navigateTo({ path: '/app/login', query: { redirect: to.fullPath } })
  }

  const allowedRoles = to.meta.allowedRoles as string[] | undefined
  if (allowedRoles && allowedRoles.length > 0) {
    // Force-refresh, same reasoning as the old store: a role assigned via
    // setUserRole moments ago must be picked up without requiring a fresh
    // login.
    const tokenResult = await user.getIdTokenResult(true)
    const role = (tokenResult.claims.role as string | undefined) ?? null
    if (!role || !allowedRoles.includes(role)) {
      return navigateTo({ path: '/app/dashboard' })
    }
  }
})
