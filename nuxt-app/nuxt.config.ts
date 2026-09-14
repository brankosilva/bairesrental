// N0 proved real per-request SSR through the actual Nitro `firebase`
// preset deploy pipeline (see ~/.claude/plans's Nuxt migration plan and
// nuxt-app/CHANGELOG.md). N1 builds the real public catalog + i18n +
// sitemap on top of that proven base.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['nuxt-vuefire', '@nuxtjs/i18n', '@nuxtjs/sitemap'],

  // Used by @nuxtjs/sitemap (via nuxt-site-config) to build absolute URLs,
  // and matches the canonical domain used throughout the old app
  // (app/src/i18n/useLocaleLinks.ts's SITE_URL) — the live site's actual
  // custom domain, not the *.web.app preview host.
  site: {
    url: 'https://www.bairesrental.com.ar',
  },

  // Old app/src/index.html's static <head> (Google Fonts preconnect + DM
  // Sans, Bootstrap 5.3 CDN, the reused-as-is css/style.css + pricing.css)
  // — ported here since Nuxt has no per-app index.html to hand-edit.
  // Per-page title/meta/canonical/hreflang/JSON-LD still come from each
  // page via useSeoMeta/useHead, same division of responsibility as before.
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      link: [
        { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          // Weight 800 added (non-italic axis) — the page CSS uses
          // font-weight: 800 extensively (hero-title, section-title,
          // stat-num, plan-precio, etc.), but this link previously only
          // requested up to 700, so the browser was synthesizing
          // (fake-bolding) 800 instead of rendering the real font file.
          // Matches the original static site's link
          // (bairesrental/index.html's own DM+Sans <link>), which already
          // requests 800.
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
          integrity: 'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH',
          crossorigin: 'anonymous',
        },
        { rel: 'stylesheet', href: '/css/style.css' },
        { rel: 'stylesheet', href: '/css/pricing.css' },
      ],
    },
  },

  i18n: {
    // Absolute canonical/hreflang URLs via useLocaleHead() — required or
    // it just warns and emits relative/empty links (see
    // node_modules/@nuxtjs/i18n's routing/head.js).
    baseUrl: 'https://www.bairesrental.com.ar',
    defaultLocale: 'es',
    // 'es' unprefixed at root (matches the live site's current URLs),
    // 'en' under /en/... — same scheme as the old hand-rolled
    // app/src/router/index.ts's routeName()/localePrefix(), now handled
    // by the module instead of hand-written route generation.
    strategy: 'prefix_except_default',
    locales: [
      { code: 'es', language: 'es-AR', file: 'es.json', name: 'Español' },
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
    ],
    // @nuxtjs/i18n's browser-language auto-detection is ON by default
    // (redirectOn: 'root', useCookie: true) — with no override here, any
    // visitor whose browser reports an English Accept-Language/
    // navigator.language got redirected from `/` straight to `/en` on
    // their very first hit, and the module then persists that choice in
    // an `i18n_redirected` cookie. Confirmed via a real headless-browser
    // navigation (curl never showed this — curl doesn't send
    // Accept-Language — only a real browser did): the very first load of
    // `/` landed on `/en` with `document.cookie` already carrying
    // `i18n_redirected=en`. Worse, the nav's ES/EN toggle
    // (`app/layouts/default.vue`) is a plain `<a :href>`, not a
    // `switchLocalePath`-aware click that also updates that cookie, so a
    // full-page navigation back to `/` hit the SAME server-side
    // auto-redirect again on every subsequent load — from an
    // English-locale browser, the site could never actually be made to
    // stay in Spanish. This is what the "can't make it translate in
    // Spanish" report was: not a translation bug, a redirect fighting the
    // manual switcher. Disabled outright: this site already ships an
    // explicit manual ES/EN switcher, so auto-detection only fights it —
    // and bouncing an Argentina-based business's own visitors to English
    // off a browser locale, ahead of the `es` default this site is
    // otherwise built around (canonical/hreflang, sitemap, etc. from N1),
    // is the wrong default here regardless of the switcher bug.
    detectBrowserLanguage: false,
  },

  // Static pages (home/departamentos/ventas/tickets, × es/en) are picked
  // up automatically from the page files + @nuxtjs/i18n's route list
  // (autoI18n). Only the per-listing dynamic routes need a runtime
  // source — see server/api/__sitemap__/urls.ts.
  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    // `/app/**` (and its `/en/app/**` locale-prefixed equivalent) is the
    // entire authenticated admin/seller/owner app — always noindex, always
    // behind real auth, and already disallowed outright in robots.txt.
    // @nuxtjs/sitemap's auto-discovery has no way to know these
    // file-based routes are gated, so without this they were showing up
    // in the sitemap despite robots.txt disallowing them — harmless (still
    // blocked, still behind auth) but inconsistent. Excluded explicitly.
    exclude: ['/app/**', '/en/app/**'],
  },

  vuefire: {
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
    },
    // N2: real server-enforced auth. `sessionCookie: true` makes
    // nuxt-vuefire mint/verify the `__session` cookie (the only cookie
    // name that survives Firebase Hosting's CDN on the way to a Cloud
    // Function — a hard platform constraint, not a config choice) via the
    // Admin SDK. This requires a service account to be resolvable at
    // `nuxt build`/`nuxt dev` time via the `GOOGLE_APPLICATION_CREDENTIALS`
    // env var (see .env — confirmed against nuxt-vuefire's module source,
    // not guessed: it checks `process.env.GOOGLE_APPLICATION_CREDENTIALS`
    // during module setup to decide whether to add the session-cookie
    // server route at all). At runtime, the deployed Cloud Function has no
    // such env var (never bundled) and falls back to Application Default
    // Credentials via its own runtime service account — which is why the
    // one-time IAM self-grant (roles/iam.serviceAccountTokenCreator on
    // 654252544387-compute@developer.gserviceaccount.com, granted to
    // itself) was needed for `createSessionCookie`/`createCustomToken` to
    // sign tokens without a local private key in that environment.
    auth: {
      enabled: true,
      sessionCookie: true,
    },
  },

  nitro: {
    preset: 'firebase',
    firebase: {
      gen: 2,
      nodeVersion: '20',
      // Named explicitly (not left as the default "server") so it's
      // unambiguous in `firebase functions:list` next to the 5 unrelated
      // functions already deployed from app/functions.
      serverFunctionName: 'nuxtSsr',
      httpsOptions: {
        region: 'southamerica-east1',
      },
    },
  },
})
