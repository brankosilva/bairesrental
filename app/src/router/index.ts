import type { RouteRecordRaw } from 'vue-router'

// URL-based locale routing (Spanish unprefixed at root — matches today's
// live URLs — English under /en/...), required for per-locale static
// pre-rendering: each locale needs its own actually-served HTML with the
// right <html lang>, canonical and hreflang tags, which a client-side
// toggle (the old approach) can't produce. See docs/marca.md and the
// approved plan's i18n section.
export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

interface PageDef {
  path: string
  baseName: string
  component: () => Promise<unknown>
}

// Single source of truth for the public, localized pages. Dynamic
// per-listing routes (departamentos/:id, ventas/:id) are enumerated at
// build time in vite.config.ts's includedRoutes, for both locale
// prefixes — vue-router still needs the parameterized definitions below
// to match and render them.
const pages: PageDef[] = [
  { path: '', baseName: 'home', component: () => import('../pages/Home.vue') },
  { path: 'departamentos', baseName: 'departamentos', component: () => import('../pages/Departamentos.vue') },
  { path: 'departamentos/:id', baseName: 'departamento-detail', component: () => import('../pages/DepartamentoDetail.vue') },
  { path: 'ventas', baseName: 'ventas', component: () => import('../pages/Ventas.vue') },
  { path: 'ventas/:id', baseName: 'venta-detail', component: () => import('../pages/VentaDetail.vue') },
  { path: 'tickets', baseName: 'tickets', component: () => import('../pages/Tickets.vue') },
]

function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`
}

// A locale-qualified route name, e.g. routeName('ventas', 'en') === 'ventas-en'.
// The default locale keeps the bare name so existing `name: 'departamentos'`
// references (nav links, router-link :to) keep working unprefixed.
export function routeName(baseName: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? baseName : `${baseName}-${locale}`
}

const localizedRoutes: RouteRecordRaw[] = LOCALES.flatMap((locale) => {
  const prefix = localePrefix(locale)
  return pages.map((p) => ({
    path: p.path ? `${prefix}/${p.path}` : prefix || '/',
    name: routeName(p.baseName, locale),
    component: p.component,
    meta: { locale, baseName: p.baseName },
  }))
})

// Auth/admin routes are deliberately NOT localized or part of the public
// marketing site's i18n — they're client-rendered app views for
// staff/sellers/owners, excluded from search indexing (see public/robots.txt).
// `allowedRoles` (checked in main.ts's router guard) gates access beyond
// plain "signed in" — Firestore rules are still the real enforcement,
// this just avoids showing the wrong role a UI they can't use anyway.
const appRoutes: RouteRecordRaw[] = [
  {
    path: '/app/login',
    name: 'app-login',
    component: () => import('../pages/app/Login.vue'),
    meta: { locale: DEFAULT_LOCALE },
  },
  {
    path: '/app/dashboard',
    name: 'app-dashboard',
    component: () => import('../pages/app/Dashboard.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true },
  },
  // Admin — full CRUD visibility across all listings + user role management.
  {
    path: '/app/admin/rentals',
    name: 'admin-rentals',
    component: () => import('../pages/app/admin/RentalsList.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['admin'] },
  },
  {
    path: '/app/admin/sales',
    name: 'admin-sales',
    component: () => import('../pages/app/admin/SalesList.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['admin'] },
  },
  {
    path: '/app/admin/users',
    name: 'admin-users',
    component: () => import('../pages/app/admin/Users.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['admin'] },
  },
  // Shared rental/sale edit form — used by both admin (any listing) and
  // sellers (their own only, enforced by Firestore rules, not by this
  // route existing at one shared path instead of two per-role copies).
  {
    path: '/app/rentals/:id',
    name: 'app-rental-form',
    component: () => import('../pages/app/RentalForm.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['admin', 'seller'] },
  },
  {
    path: '/app/sales/:id',
    name: 'app-sale-form',
    component: () => import('../pages/app/SaleForm.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['admin', 'seller'] },
  },
  // Seller — self-service listings + the CRM-lite (trackable links + leads).
  {
    path: '/app/seller/listings',
    name: 'seller-listings',
    component: () => import('../pages/app/seller/Listings.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['seller'] },
  },
  {
    path: '/app/seller/links',
    name: 'seller-links',
    component: () => import('../pages/app/seller/Links.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['seller'] },
  },
  {
    path: '/app/seller/leads',
    name: 'seller-leads',
    component: () => import('../pages/app/seller/Leads.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['seller'] },
  },
  // Owner — read-only status view, v1 scope (see docs/negocio.md).
  {
    path: '/app/owner',
    name: 'owner-dashboard',
    component: () => import('../pages/app/owner/OwnerDashboard.vue'),
    meta: { locale: DEFAULT_LOCALE, requiresAuth: true, allowedRoles: ['owner'] },
  },
]

// Public — anonymous visitors land here from a seller's shared link.
// Deliberately NOT enumerated in vite.config.ts's includedRoutes (codes
// are created dynamically at runtime, long after any build) — Firebase
// Hosting rewrites any /l/** request to the prerendered home page's HTML
// (see firebase.json), and vue-router then resolves the *actual* browser
// URL client-side once that shell loads, exactly like a classic SPA
// fallback for a route that can't be known ahead of time.
const publicDynamicRoutes: RouteRecordRaw[] = [
  {
    path: '/l/:code',
    name: 'link-redirect',
    component: () => import('../pages/LinkRedirect.vue'),
    meta: { locale: DEFAULT_LOCALE },
  },
]

export const routes: RouteRecordRaw[] = [...localizedRoutes, ...appRoutes, ...publicDynamicRoutes]
