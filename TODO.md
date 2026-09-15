# TODO

Ideas pendientes, con el contexto necesario para retomarlas. No es un backlog
formal: lo que está acá todavía no se decidió hacer.

---

## Links de vendedores en un dominio neutro (sin la marca BairesRental)

**Idea.** Que el link que comparte un vendedor no delate la inmobiliaria. Hoy
sale `https://www.bairesrental.com.ar/l/<code>`; la alternativa es comprar un
dominio neutro y apuntarlo al mismo deploy, para que el link sea
`https://<dominio-neutro>/l/<code>`.

**Lo que ya juega a favor (verificado el 2026-09-15):**

- El layout `branded` (`nuxt-app/app/layouts/branded.vue`) ya está sin marca a
  propósito: no hereda el nav, los FABs ni el pie de `default.vue`. La página
  se presenta como del vendedor.
- Las páginas `/l/*` **no declaran `og:url`** — `useSharedLinkSeo.ts` no lo
  setea y el layout `branded` no llama a `useLocaleHead()`, que es quien lo
  emite en el resto del sitio. O sea que WhatsApp arma el preview con la URL
  que le pegaste y no hay rebote al dominio de la marca. (Comprobado con
  `curl -A facebookexternalhit` contra `/l/<code>` en vivo.)
- `/l/*` es `noindex, nofollow` y está excluido del sitemap (ver el bloque
  `sitemap` de `nuxt.config.ts`), así que no hay riesgo de contenido duplicado.
- Firebase Hosting admite varios dominios sobre el mismo site: el dominio
  neutro puede servir este mismo deploy sin infraestructura aparte.

**Lo que hay que hacer:**

1. Separar el origen de los links del origen del sitio. Hoy `useLinkUrl()`
   (`nuxt-app/app/composables/useLinkStats.ts`) lee `site.url`, que es la misma
   constante (`SITE_URL` en `nuxt.config.ts`) con la que se arman `canonical`,
   `hreflang` y `og:url` de las 88 fichas públicas: no se puede mover una sin
   mover la otra. Va un `runtimeConfig.public.linkBaseUrl` propio —que es lo
   que ya da por hecho el comentario de `createTrackableLink` en
   `nuxt-app/functions/src/index.ts`— con fallback a `site.url`.
2. Comprar el dominio y agregarlo como dominio custom del site de Hosting.
3. Revisar el contenido de `/l/:code` y `/l/:code/:propertyId` con ojo de
   "¿esto dice BairesRental?": el CSS (`/css/br-brand.css`), la tarjeta de
   contacto del vendedor y los textos. El layout ya está limpio, pero nadie lo
   auditó con este objetivo.

**Decisión pendiente:** si el objetivo es solo que la URL no diga
"bairesrental", los puntos 1 y 2 alcanzan. Si es que el visitante no se entere
de la inmobiliaria en ningún momento, el punto 3 puede crecer bastante.
