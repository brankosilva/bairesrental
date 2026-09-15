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
  // Sans, Bootstrap 5.3 CDN, y las hojas propias — hoy br-base.css +
  // br-catalog.css; ver la nota en el bloque `link` de abajo)
  // — ported here since Nuxt has no per-app index.html to hand-edit.
  // Per-page title/meta/canonical/hreflang/JSON-LD still come from each
  // page via useSeoMeta/useHead, same division of responsibility as before.
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
        // Icon font for the authenticated /app/* admin/seller/owner pages
        // (row action icons, copy buttons, etc.) — the marketing site
        // doesn't use these, but there's no per-layout way to scope a CDN
        // <link> in Nuxt's head config, so it loads sitewide like the
        // other two stylesheets above.
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css' },
        // Estas dos van DESPUÉS de Bootstrap a propósito: pisan lo que
        // haga falta y el orden de cascada queda determinista (un <link>
        // explícito, no la inyección de Vite, que puede diferir entre dev
        // y prod).
        //
        // Antes acá se cargaban `/css/style.css` y `/css/pricing.css`:
        //  - style.css eran 4181 líneas, de las cuales las primeras 3130
        //    eran la plantilla legacy "fh5co" compilada desde sass/. Esa
        //    mitad definía reglas de elemento sin scope
        //    (`p { font-size:14px !important }`, `h2 { font-size:2rem
        //    !important }`, `h1..h6 { font-family:"Roboto Slab" }`,
        //    `body { color:#828282 }`, y también `.row`, `.container`,
        //    `.btn`, `.form-control` de Bootstrap) que ningún
        //    `<style scoped>` de Vue puede ganar, y que rompían TODAS las
        //    páginas. Se partió en br-catalog.css (el sistema `br-*`, que
        //    es lo único que la app usa) + legacy-template.css (se
        //    conserva en disco como referencia, no se carga). Ver el
        //    encabezado de cada archivo.
        //  - pricing.css eran 175 líneas de clases `.pricing*` que no
        //    aparecen en ningún .vue de la app. Se borró.
        { rel: 'stylesheet', href: '/css/br-base.css' },
        { rel: 'stylesheet', href: '/css/br-catalog.css' },
      ],
      // GA4 + Meta Pixel. Estaban en todas las páginas del sitio estático
      // (index.html:4-12 y :833-848) y no se habían migrado, o sea que la
      // app Nuxt no medía absolutamente nada — ni analytics ni atribución
      // de las campañas de Meta Ads. Mismos IDs que el sitio publicado.
      script: [
        { src: 'https://www.googletagmanager.com/gtag/js?id=G-3Q9QZ52W03', async: true },
        {
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3Q9QZ52W03');`,
        },
        {
          innerHTML: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1704524150703684');fbq('track','PageView');`,
        },
      ],
      noscript: [
        {
          innerHTML: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1704524150703684&ev=PageView&noscript=1" />`,
          tagPosition: 'bodyOpen',
        },
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
  // NUXT-NEW: sitemap.xml generado. El estático tenía un sitemap.xml a mano.
  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    // `/app/**` (and its `/en/app/**` locale-prefixed equivalent) is the
    // entire authenticated admin/seller/owner app — always noindex, always
    // behind real auth, and already disallowed outright in robots.txt.
    // @nuxtjs/sitemap's auto-discovery has no way to know these
    // file-based routes are gated, so without this they were showing up
    // in the sitemap despite robots.txt disallowing them — harmless (still
    // blocked, still behind auth) but inconsistent. Excluded explicitly.
    // `/l/**` son los links que comparte cada vendedor: páginas privadas de
    // un solo destinatario, noindex, y cada visita de un crawler se
    // registraría como una apertura. Fuera del sitemap además de robots.txt.
    exclude: ['/app/**', '/en/app/**', '/l/**', '/en/l/**'],
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
