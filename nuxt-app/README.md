# BairesRental — Nuxt 4 SSR app

The live app at `bairesrental.web.app`: a Nuxt 4 app doing real
per-request SSR against Firebase, via
[`nuxt-vuefire`](https://vuefire.vuejs.org/nuxt/). It replaced an earlier
Vue 3 + `vite-ssg` build-time-prerendered rewrite that lived in `app/` at
the repo root; that folder has since been deleted, and its Cloud
Functions (`functions/`), Firestore/Storage rules and its changelog
(`docs/historial-app-vue.md`) were moved here. The original static HTML
site still serves `www.bairesrental.com.ar` from the repo root via GitHub
Pages — the DNS cutover is a separate, not-yet-taken step.

**Status: N0–N1 done.** See `CHANGELOG.md` for what was actually built and
verified in each milestone, including real gotchas (a `firebase-functions`
version pin that must not drift, a `.output/server` `node_modules`-pruning
issue that needs a workaround before every functions deploy).

Live (on the `n1-catalog` Hosting preview channel, not yet the production
domain): home (full marketing content), `/departamentos` +
`/departamentos/:id`, `/ventas` + `/ventas/:id`, `/tickets` — in **es
(unprefixed) and en (`/en/...`)** via `@nuxtjs/i18n`, reading real
Firestore data on every request (not prerendered), with per-page SEO
(title/description/OG/canonical/hreflang/JSON-LD) and a dynamic
`sitemap.xml` via `@nuxtjs/sitemap`. Listing detail pages show a plain
WhatsApp contact link — lead-capture-before-WhatsApp is deferred to a
later milestone (see `CHANGELOG.md`'s N1 entry for why). No auth, no
admin/seller/owner app yet (N2/N3).

## Critical safety notes before touching Firebase config here

- This folder now owns **two separate Functions codebases** in the
  `bairesrental` project: `"nuxtssr"` (the SSR handler, built from
  `.output/server` by `npm run build`) and `"default"` (the 11 callable /
  trigger functions in `functions/` — `setUserRole`, `inviteUser`,
  `updateUser`, `deleteUser`, `createTrackableLink`, `submitLead`,
  `uploadListingImage`, `onUserCreate`, plus the two legacy `?id=`
  redirect functions). Always deploy scoped to the one you changed
  (`firebase deploy --only functions:nuxtssr` or `--only
  functions:default`), never a bare `firebase deploy`.
- `firebase deploy --only hosting` here publishes the live release at
  `bairesrental.web.app` — use `firebase hosting:channel:deploy
  <channel-name>` for anything you want to check first.
- Before **and** after any functions deploy, run `firebase functions:list`
  and confirm the codebase you weren't deploying is unchanged.
- `firestore.rules`, `firestore.indexes.json` and `storage.rules` live
  here now and are the only copies — `firebase deploy --only
  firestore,storage` publishes them.

## First-time setup

1. `npm install` inside `nuxt-app/` (keeps `firebase-functions` pinned to
   `^6.6.0` — see `CHANGELOG.md`'s N0 entry for why letting it drift to
   `^7.x` breaks deploys).
2. Copy the Firebase Web SDK config into `.env` (see `.env`'s existing
   keys — `NUXT_PUBLIC_FIREBASE_*`), plus
   `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json` pointing at
   the gitignored Admin SDK key in this folder (needed at `nuxt dev` /
   `nuxt build` time for the session-cookie server route, and by
   `functions/scripts/bootstrap-admin.js`).

## Local development

```
npm run dev
```

Reads live Firestore data via `nuxt-vuefire`'s client SDK — there's no
prerendering step to remember to re-run. Use `curl` (not a browser)
against a page to confirm SEO tags are actually server-rendered:

```
curl -s http://localhost:3000/departamentos/<a-real-id> | grep -o '<title>[^<]*</title>'
```

## Deploying via CI (the normal path)

Pushing a `v*` tag whose commit is on `main` runs
[`.github/workflows/deploy-nuxt.yml`](../.github/workflows/deploy-nuxt.yml),
which builds and deploys everything in this folder — both Functions
codebases, Hosting, and the Firestore/Storage rules — then smoke-tests the
published home page for server-rendered HTML:

```
git tag v1.0.0 && git push origin v1.0.0
```

The same workflow can be run by hand from the Actions tab with a picker for
a single piece (`hosting`, `functions:nuxtssr`, `functions:default`,
`reglas`). It encodes both deploy gotchas below, so CI can't forget them.

### One-time setup

1. **A service account for CI.** The existing `serviceAccountKey.json`
   (Firebase Admin SDK) does **not** carry deploy permissions — it's for
   the Admin SDK at build time, not for publishing. Create a dedicated one
   in the Google Cloud console with: Firebase Admin, Cloud Functions Admin,
   Cloud Run Admin, Service Account User, Artifact Registry Writer, API Keys
   Viewer. Then:
   ```
   gh secret set FIREBASE_SERVICE_ACCOUNT < /path/to/ci-service-account.json
   ```
2. **The public web config**, straight out of your local `.env` (these ship
   to the browser in the bundle, so they're repo *variables*, not secrets):
   ```
   grep '^NUXT_PUBLIC_FIREBASE' .env | while IFS='=' read -r k v; do
     gh variable set "$k" --body "$v"
   done
   ```

The job runs in a GitHub Environment called `production`, so you can add
required reviewers there if you ever want a human gate before a tag ships.

## Building + deploying by hand

```
npm run build
```

Then, **before every functions deploy** (Nitro's `firebase` preset prunes
`.output/server`'s `node_modules` in a way that breaks `firebase-tools`'
own deploy-time static analysis otherwise):

```
cd .output/server && npm install --omit=dev && cd ../..
firebase deploy --only functions:nuxtssr
firebase functions:list   # confirm the "default" codebase is untouched
firebase deploy --only hosting            # publishes the live release
# ...or, to check it first: firebase hosting:channel:deploy <channel-name>
```

To deploy the callable/trigger functions instead (they build via the
`predeploy` hook in `firebase.json`):

```
firebase deploy --only functions:default
```

---

## Paridad visual con el sitio estático

La migración del sitio estático (raíz del repo) a Nuxt trajo el markup y los
datos, pero no la capa de presentación. Se restauró; esta sección documenta
las dos causas de fondo y cómo quedó, para que no se vuelvan a introducir.

### Arquitectura de CSS

| Archivo | Rol |
|---|---|
| `public/css/br-base.css` | Tokens (`--azul`, `--negro`, …), reset y tipografía por defecto. Un único `:root` global. |
| `public/css/br-catalog.css` | Sistema de diseño `br-*`: filtros, cards, badges, mapa, panel admin. **Todo en px** (ver abajo). |
| `public/css/legacy-template.css` | Plantilla "fh5co" heredada. **No se carga.** Se conserva solo como referencia. |

Dos cosas que conviene no deshacer:

1. **No volver a cargar `legacy-template.css`.** Define reglas de elemento sin
   scope (`p { font-size:14px !important }`, `h2 { font-size:2rem !important }`,
   `h1..h6 { font-family:"Roboto Slab" }`, `body { color:#828282 }`) que ningún
   `<style scoped>` de Vue puede ganar. En el sitio estático eran inofensivas
   porque `index.html` no cargaba ninguna hoja; acá pisaban todas las páginas.

2. **`br-catalog.css` va en px, no en rem.** `departamentos.html` y
   `ventas.html` cargan `css/bootstrap.css` (Bootstrap 3) además de Bootstrap 5,
   y Bootstrap 3 trae `html { font-size: 10px }`. Todo el sistema `br-*` se
   diseñó contra ese root de 10px. Nuxt no carga Bootstrap 3, así que en rem
   cada medida rendereaba 1,6× más grande.

`line-height` también difiere por página, porque en el estático dependía de qué
hojas cargaba cada una: la home no cargaba ninguna (`normal`), los catálogos y
tickets cargaban `style.css` (`1.7`), y las fichas solo Bootstrap (`1.5`). Está
reproducido página por página.

### Modo vendedor

`catalogo-vendedores.html` / `ficha-vendedor.html` no se habían migrado. Ahora
es `?vendor=1` sobre las rutas que ya existen (`/departamentos`,
`/departamentos/:id`) — ver `app/composables/useVendorMode.ts`. Esconde todos
los WhatsApp, reduce la nav a logo + idioma, saca los FABs y pone
`noindex, nofollow`.

### Funcionalidades que solo existen en Nuxt

Están marcadas en el código para poder revisarlas de a una:

```
grep -rn "NUXT-NEW\|NUXT-DEVIATION" app/ public/css/ nuxt.config.ts
```

- `NUXT-NEW` — no existe en el sitio estático: i18n por ruta, mapa Leaflet +
  vista Lista/Mapa, grilla de destacados desde Firestore en la home, link
  activo en la nav, sitemap generado, badge "MÁS POPULAR" traducible, estado
  `disabled` del botón de contacto, barra rápida de filtros en mobile.
- `NUXT-DEVIATION` — se apartó del estático a propósito: los FABs ahora
  aparecen también en las fichas de detalle (en el estático no estaban).

## Previews de link (og:image)

Cuando se comparte una ficha por WhatsApp, Facebook, X o LinkedIn, el preview
sale de los `og:*` que renderiza el SSR. Hay dos piezas que tienen que estar
bien o el link sale sin foto:

**1. `og:url` tiene que apuntar al dominio donde vive este deploy.**
WhatsApp y Facebook no arman el preview con la URL que pegaste: leen el
`og:url` de esa página y vuelven a scrapear *esa* URL. Mientras el cutover de
DNS siga pendiente, `www.bairesrental.com.ar` sirve el sitio estático viejo y
devuelve 404 en `/departamentos/<id>`, así que apuntar ahí deja todas las
fichas sin preview. Lo maneja `NUXT_PUBLIC_SITE_URL` (ver `SITE_URL` en
`nuxt.config.ts` y el bloque `env:` de `.github/workflows/deploy-nuxt.yml`).

**2. `og:image` tiene que ser un derivado 1200x630, no la portada cruda.**
Las portadas que suben los vendedores son fotos de celular verticales de 2-4 MB.
WhatsApp descarta cualquier `og:image` de más de ~300 KB —no muestra nada— y
todas las plataformas esperan un apaisado ~1.91:1. La extensión
`storage-resize-images` genera el derivado en cada upload y `app/utils/ogImage.ts`
construye su URL.

### Poner la extensión en marcha (una sola vez)

La extensión está declarada en `firebase.json` y parametrizada en
`extensions/storage-resize-images.env`, así que se despliega como todo lo demás:

```bash
firebase deploy --only extensions --project bairesrental
```

Ojo: **no tiene backfill** — los parámetros están comenteados upstream en su
`extension.yaml`. Solo procesa uploads nuevos, así que las portadas que ya
estaban en el bucket necesitan que se reescriba el objeto para disparar el
trigger. Eso hace `scripts/backfill-og-images.js`.

### Orden de los pasos

El orden importa: si se despliega el sitio antes de que existan los derivados,
las fichas quedan apuntando a un `og:image` que devuelve 404 y el preview sale
*peor* que sin nada.

```bash
firebase deploy --only extensions --project bairesrental  # 1. instalar
node scripts/backfill-og-images.js                        # 2. chequear (no escribe)
node scripts/backfill-og-images.js --run                  # 3. disparar los que falten
node scripts/backfill-og-images.js                        # 4. confirmar 0 faltantes
                                                          # 5. recién ahí, desplegar
```

El paso 4 tiene que terminar en "✅ Todas las portadas tienen su derivado".
El smoke test del workflow de deploy vuelve a chequear lo mismo contra el sitio
publicado (que `og:url` resuelva 200 y que `og:image` exista y pese poco), así
que si algo de esto se rompe, el deploy falla en vez de publicar links mudos.

### Volver a scrapear un link ya compartido

Facebook y WhatsApp cachean el preview por URL. Después de arreglar algo hay que
forzar el re-scrape en <https://developers.facebook.com/tools/debug/> pegando la
URL y tocando "Scrape Again" — WhatsApp usa el mismo caché.
