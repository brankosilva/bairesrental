// Dynamic sitemap source for @nuxtjs/sitemap (nuxt.config.ts's
// `sitemap.sources: ['/api/__sitemap__/urls']`), replacing the old
// app/scripts/generate-sitemap.js postbuild script — this queries the
// real `rentals`/`sales` collections at request time (Nitro caches the
// response per the module's own defaults) instead of baking a frozen list
// into the build.
//
// Static pages (home/departamentos/ventas/tickets) are NOT listed here —
// @nuxtjs/sitemap already discovers them automatically from the page
// files, and its `autoI18n` integration (auto-enabled when @nuxtjs/i18n is
// present) expands every URL below into es/en with hreflang alternates,
// same end result as the old script's hand-rolled localizedEntries().
//
// Each entry below sets `_i18nTransform: true` — required for a *runtime*
// source (as opposed to a statically-discovered page route) to be expanded
// per-locale by autoI18n at all. Confirmed by reading
// `@nuxtjs/sitemap`'s own runtime (`dist/runtime/server/sitemap/builder/
// entries.js`'s `resolveSitemapEntries()`), not guessed: without this flag,
// a bare `{ loc: '/departamentos/<id>' }` entry is treated as an
// already-localized `es` URL, and the only way it gains an `en` alternate
// is if some *other* source entry happens to share the same
// locale-stripped path — which never happens here, since this source never
// emits an `/en/...` counterpart itself. With `_i18nTransform: true`, the
// module calls its own `resolveI18nRouteEntries()` on the bare path and
// synthesizes the full set of locale variants (here: `es` at the bare path
// and `en` under `/en/...`) plus correct hreflang alternates (including
// `x-default`) on each one — this is the same mechanism
// `i18n.pages`-derived routes use internally, just applied to a runtime
// source instead of a static page.
//
// Deliberately uses the plain Firestore client SDK (`firebase/app` +
// `firebase/firestore`), not the Admin SDK — Admin SDK/service-account
// wiring into the Nitro runtime is N2 scope (session cookies), and
// firestore.rules already allows public reads on `rentals`/`sales`, the
// same access the public catalog pages themselves rely on. A dedicated
// named app avoids depending on nuxt-vuefire's own Vue-plugin-driven app
// initialization, which this bare API route (outside the Vue render
// pipeline) can't assume has already run.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore'
import type { SitemapUrlInput } from '#sitemap/types'

const SITEMAP_APP_NAME = 'sitemap-source'

export default defineEventHandler(async (): Promise<SitemapUrlInput[]> => {
  const { public: publicConfig } = useRuntimeConfig()
  const firebaseConfig = publicConfig.vuefire.config

  const app = getApps().some((a) => a.name === SITEMAP_APP_NAME)
    ? getApp(SITEMAP_APP_NAME)
    : initializeApp(firebaseConfig, SITEMAP_APP_NAME)
  const db = getFirestore(app)

  // Sólo lo aprobado. Este handler usa el SDK CLIENTE sin autenticar (igual que
  // las páginas públicas en SSR), así que pasa por firestore.rules: sin el
  // `where` la query no devuelve menos URLs, rebota entera y el sitemap se
  // queda sin fichas. Ver el encabezado de app/utils/revision.ts.
  const aprobadas = (nombre: 'rentals' | 'sales') =>
    getDocs(query(collection(db, nombre), where('revision', '==', 'aprobada')))
  const [rentals, sales] = await Promise.all([aprobadas('rentals'), aprobadas('sales')])

  return [
    ...rentals.docs.map((d) => ({ loc: `/departamentos/${d.id}`, _i18nTransform: true })),
    ...sales.docs.map((d) => ({ loc: `/ventas/${d.id}`, _i18nTransform: true })),
  ]
})
