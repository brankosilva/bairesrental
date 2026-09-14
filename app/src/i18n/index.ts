import { createI18n } from 'vue-i18n'
import es from './locales/es.json'
import en from './locales/en.json'

// A factory, not a module-level singleton: vite-ssg renders many routes
// concurrently (default concurrency 20), each calling the ViteSSG factory's
// setup callback to build its own app/router instance. Pages with an async
// `setup()` (top-level `await getAllRentals()` etc.) yield the event loop
// mid-render, so a single shared `i18n.global.locale` ref would race across
// routes rendering at the same time — one route's `router.beforeEach` could
// flip the locale while another route was paused on its own await, baking
// the wrong language into that page's prerendered HTML. Each app instance
// gets its own i18n instance instead, so there's nothing to race over.
export function createI18nInstance() {
  return createI18n({
    legacy: false,
    locale: 'es',
    fallbackLocale: 'es',
    messages: { es, en },
  })
}
