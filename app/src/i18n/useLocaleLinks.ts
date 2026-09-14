import { useRoute, useRouter } from 'vue-router'
import { LOCALES, DEFAULT_LOCALE, routeName, type Locale } from '../router'

const SITE_URL = 'https://www.bairesrental.com.ar'

// Per-page hreflang alternates + the "switch language" link for the
// current page (same listing/route, other locale) — computed from the
// route's baseName + params via router.resolve rather than string
// manipulation, so it stays correct if route paths ever change.
export function useLocaleLinks() {
  const route = useRoute()
  const router = useRouter()
  const baseName = (route.meta.baseName as string) || 'home'
  const currentLocale = (route.meta.locale as Locale) || DEFAULT_LOCALE
  const otherLocale: Locale = currentLocale === 'es' ? 'en' : 'es'

  function hrefFor(locale: Locale): string {
    const { href } = router.resolve({ name: routeName(baseName, locale), params: route.params })
    return `${SITE_URL}${href}`
  }

  return {
    currentLocale,
    otherLocale,
    otherLocaleHref: hrefFor(otherLocale),
    hreflangLinks: [
      ...LOCALES.map((l) => ({ rel: 'alternate', hreflang: l, href: hrefFor(l) })),
      { rel: 'alternate', hreflang: 'x-default', href: hrefFor(DEFAULT_LOCALE) },
    ],
  }
}
