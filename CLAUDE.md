# BairesRental

Sitio web de **BairesRental**, empresa de administración de alquileres temporarios en Buenos Aires (CABA), Argentina.

Documentación detallada del negocio, la marca y el catálogo en [`docs/`](docs/README.md) — este archivo cubre lo operativo (stack, estructura, convenciones, carga de propiedades).

> **El sitio estático se dio de baja.** Hasta septiembre de 2026 el repo tenía, en la raíz, un sitio HTML/jQuery servido por GitHub Pages, con el catálogo en `data/*.json`. Ya no existe: `www.bairesrental.com.ar` apunta a Firebase Hosting y sirve la app de [`nuxt-app/`](nuxt-app/), con el catálogo en Firestore. Los archivos viejos siguen en el historial de git si hace falta consultarlos.

## Stack

- **Nuxt 4** (Vue 3, SSR) en `nuxt-app/` — todo el sitio vive acá
- **Firebase**: Hosting + Cloud Functions (SSR de Nitro y callables), Firestore (catálogo), Storage (fotos), Auth (panel interno)
- **i18n** es/en con `@nuxtjs/i18n`
- **Leaflet** (CDN) para el mapa del catálogo
- CSS propio en `nuxt-app/public/css/` — sin framework de utilidades

## Rutas

| Ruta | Sección |
|---|---|
| `/` | Home — hero, propuesta de valor, planes, calculadora de ingresos, reviews, contacto |
| `/departamentos` · `/departamentos/[id]` | Catálogo de alquiler temporario y ficha de detalle |
| `/ventas` · `/ventas/[id]` | Catálogo de departamentos en venta y ficha de detalle |
| `/requisitos` | Requisitos y proceso para alquilar — versión web de `docs/requisitos-alquiler.pdf` |
| `/tickets` | Landing de "Baires-Football Experience" (negocio paralelo) |
| `/app/*` | Panel interno con login: admin (propiedades, usuarios, links), vendedores (listings, leads, links, perfil), propietarios |
| `/l/[code]` | Links rastreables que generan los vendedores |

Modo vendedor: `?vendor=1` sobre las rutas públicas (sin WhatsApp, `noindex`) — reemplaza a los viejos `catalogo-vendedores.html` / `ficha-vendedor.html`.

Las URLs viejas del sitio estático (`/departamentos.html`, `/departamento.html?id=…`, etc.) redirigen con 301 — ver los `redirects` de `nuxt-app/firebase.json` y `nuxt-app/server/routes/`.

## Estructura de archivos

```
/
├── nuxt-app/       # El sitio. Ver nuxt-app/README.md
│   ├── app/        # pages, components, composables, layouts, utils, types
│   ├── public/     # css propio, imágenes, fuentes, docs, favicons
│   ├── server/     # rutas de servidor (redirects legacy, links rastreables)
│   ├── functions/  # Cloud Functions (setUserRole, submitLead, uploadListingImage…)
│   └── firebase.json, firestore.rules, storage.rules, firestore.indexes.json
├── scripts/        # Mantenimiento del catálogo contra Firestore (ver abajo)
│   └── lib/        # Acceso compartido a Firestore
├── docs/           # Documentación del negocio y la marca
├── marketing/      # Brand guide y estrategia de Meta Ads
└── .github/workflows/
    ├── deploy-nuxt.yml        # deploy a Firebase (se dispara con un tag v*)
    └── check-ficha-links.yml  # auditoría semanal de fichas de Tokko
```

## Panel interno (`/app/*`) y links de vendedores

Mapa para no tener que reconstruirlo leyendo archivo por archivo. Detalle
histórico de cada decisión en [`nuxt-app/CHANGELOG.md`](nuxt-app/CHANGELOG.md).

**Roles** (`admin` / `seller` / `owner`): claim de Auth + espejo en
`users/{uid}`. Los escribe **siempre** una Cloud Function — `firestore.rules`
tiene `allow write: if false` sobre `/users`, para que el claim y el documento
no puedan divergir.

| Archivo | De qué es dueño |
|---|---|
| `nuxt-app/functions/src/index.ts` | Todos los callables: `inviteUser`, `updateUser`, `deleteUser`, `createTrackableLink`, `ensureSellerLink`, `submitLead`, `uploadListingImage`, `importListingImage`, `importFromFicha` |
| `nuxt-app/app/types/link.ts` | Forma de `links/{code}`, `links/{code}/opens/{id}` y `sellerProfiles/{uid}` |
| `nuxt-app/app/utils/sellerScope.ts` | Qué publicaciones ve y comparte un vendedor (`isShareableBySeller`) y cuáles puede **editar** (`isOwnListing`) |
| `nuxt-app/app/utils/revision.ts` | El estado de revisión y el predicado `estaPublicada()` |
| `nuxt-app/app/composables/useLinkStats.ts` | Métricas y etiquetas compartidas entre la pantalla del vendedor y la del admin |
| `nuxt-app/app/utils/linkVisitor.ts` | El id del visitante en `localStorage` y la sesión de 30 min: decide si el ping se manda y si cuenta |
| `nuxt-app/server/api/l/[code]/open.post.ts` | Registra la apertura que avisa el navegador |
| `nuxt-app/server/middleware/01.link-open.ts` | Headers de `/l/*` (no-store, noindex) y conteo de **bots** — las personas ya no se cuentan acá |
| `nuxt-app/server/api/l/[code].get.ts` | Payload de la página compartida (Admin SDK: `links` no es público) |
| `nuxt-app/firestore.rules` | Quién lee y escribe cada colección |

### Aprobación de propiedades — las reglas del juego

Lo que carga un vendedor **no sale al sitio hasta que un admin lo aprueba**.

- Campo `revision` (`pendiente` / `aprobada` / `rechazada`) en `rentals` y
  `sales`, más `motivoRechazo`, `revisadaPor` y `revisadaEn`, que escribe sólo
  el admin. Quién la cargó: `sellerUid` + `sellerNombre` desnormalizado.
- El vendedor carga y queda `pendiente`. **Editar una aprobada la vuelve a
  mandar a revisión** — si no, se aprueba una ficha limpia y después le cambian
  el texto. Cambiar sólo la disponibilidad NO la baja del sitio: es la excepción
  explícita de `firestore.rules`.
- El admin aprueba o rechaza desde `/app/admin/revision`. Rechazar pide motivo,
  el vendedor lo ve en su panel, corrige y vuelve a la cola.
- Lo que carga un admin —panel o scripts— queda aprobado al instante.

**`revision` no puede faltar en un documento.** El catálogo, la home y el
sitemap consultan con `where('revision','==','aprobada')`, y un `where` de
igualdad no matchea documentos sin el campo: la propiedad desaparece del sitio
sin dar error. Por eso `scripts/lib/catalogo.js` lo escribe siempre y existe
`scripts/backfill-revision.js`.

**Cuidado con la forma de la regla de lectura.** `list` no se evalúa documento
por documento: Firestore analiza la *query* contra la regla y rebota la request
entera si no puede probar que todo resultado pasa. Por eso la regla es la
comparación literal `resource.data.revision == 'aprobada'` y las queries
públicas llevan el `where`; una forma más "tolerante" con `.get(campo, default)`
deja el catálogo público vacío. Y `isSignedIn()` va primero en el `||`: leer una
clave inexistente en Rules es un **error**, no `false`.

### Links de vendedor — las reglas del juego

- **Cada vendedor tiene un link personal creado con la cuenta**, con el slug
  de su nombre de código (`/l/juan-perez`), apuntado a **todo el catálogo**.
  Lo hace `ensurePrimaryLink()`; no se genera a mano y no se desactiva.
- El formulario de `/app/seller/links` es para links **aparte** (una
  publicación o una campaña). El nombre del link es opcional y es del link,
  no de un destinatario.
- **Los códigos se leen**: los links aparte cuelgan del slug personal
  (`juan-perez-monoambientes`). Los arma `createTrackableLink` con
  `primaryLinkCodeFor()` + el slug del nombre.
- **Todo el catálogo es compartible por cualquier vendedor.** Editar sigue
  siendo sólo de quien cargó la publicación.
- Los contadores (`opens`, `botOpens`, `whatsappClicks`, `leads`) los escribe
  **sólo** el Admin SDK. Pueden faltar en documentos viejos: leerlos con `n()`.

### Acoplamientos — si tocás uno, tocá el otro

1. **El patrón del código del link** vive en `01.link-open.ts` (hoy hasta 80
   caracteres) y los largos de cada parte, en `functions/src/index.ts`
   (40 del slug personal + 30 del sufijo). Si no coinciden, el link anda pero
   sus aperturas no se cuentan en ningún lado.
2. **El parseo de ficha.info** vive en `scripts/lib/ficha.js` y otra vez, en
   TypeScript, en `nuxt-app/functions/src/ficha.ts` — `functions/` es un paquete
   aparte y no puede importar de `scripts/`. El mapeo tiene que dar lo mismo
   desde la terminal que desde el panel. El de **venta** (`fichaToSale`) existe
   sólo del lado de `functions/`: de la terminal se cargan sólo alquileres. Lo de **fichaprop.tech**
   vive dos veces igual: `scripts/lib/fichaprop.js` + el mapeo de `add-from-tencery.js` de un lado,
   y `nuxt-app/functions/src/fichaprop.ts` —que trae las dos cosas juntas— del otro.
3. **`isShareableBySeller()`** se aplica en el panel, en el selector de links,
   en `createTrackableLink` y en la página compartida. `functions/` es un
   paquete TypeScript aparte y **no importa** ese módulo: tiene su copia.
4. **`label` / `labelLower`** son los campos de hoy; `recipientName` /
   `recipientNameLower` son los viejos, que se leen pero no se escriben. Todo
   lo que muestre el nombre de un link usa `linkLabel()`.
5. **El conteo de aperturas es cliente + servidor.** `linkVisitor.ts` arma
   el ping (`v`, `n`, `c`, `p`) y `open.post.ts` lo lee. No se puede volver
   a contar desde el middleware: una cookie propia no llega —Firebase
   Hosting borra todas menos `__session`, que usa Auth— y contar por request
   es contar recargas.
6. **`firestore.rules`** enumera con `hasOnly()` los campos que el cliente
   puede tocar de un link. Un campo nuevo que el vendedor edite desde el
   navegador hay que agregarlo ahí o falla en silencio.

### Para probar

```
cd nuxt-app && npm install && npm run build     # el build typechequea las páginas
cd nuxt-app/functions && npm install && npx tsc --noEmit
```

---

## Convenciones

- Todo el contenido está en **español rioplatense** (vos/ustedes), con traducción al inglés en `nuxt-app/i18n/locales/`.
- Los cambios de estilo van en `nuxt-app/public/css/` (`br-base.css`, `br-catalog.css`, `br-app.css`). No tocar `legacy-template.css`.
- **Ojo con los `rem`**: `br-catalog.css` está en px a propósito. El diseño original se hizo contra el root de 10px que traía Bootstrap 3 en el sitio estático; Nuxt usa 16px. Ver el encabezado del archivo.
- No introducir dependencias nuevas sin necesidad.
- Para probar: `cd nuxt-app && npm run dev`. Para compilar: `npm run build`.

## Ritmo de trabajo: fallar rápido

Preferencia explícita de Victor: **menos verificación local, más vueltas cortas mirando lo deployado.**

- No correr `npm run build` ni typecheck para "confirmar" un cambio: hacerlo, commitear y ver el resultado en el deploy.
- No re-leer archivos recién editados ni re-grepear para chequear que la edición quedó.
- Un intento por vuelta. Si algo sale mal se ve en el deploy o en la consola y se corrige en la siguiente — no encadenar rondas de chequeos preventivos antes de entregar.
- Nada de tests, validaciones defensivas ni manejo de errores extra que no se hayan pedido.
- Reportar corto: qué se cambió y dónde. Sin resúmenes largos ni checklists.
- Para cambios de UI el loop rápido sigue siendo `npm run dev`, que es más barato que un deploy.

**Cómo se mira lo deployado.** El deploy sale con un tag (`git tag v1.0.6 && git push origin v1.0.6`) o a mano desde Actions → *Deploy nuxt-app a Firebase*, eligiendo el target — pero ojo: `hosting` solo publica lo estático de `public/` (CSS, imágenes, PDFs) y tarda ~1:30; cualquier cambio en un `.vue` lo renderiza la function SSR, así que necesita `functions:nuxtssr`, que es justo la parte lenta. Ese workflow ya corre el build y, después de publicar, el smoke test de la home y el chequeo de los `og:*`: **el CI es la verificación**, no hace falta duplicarla en local. Los dos smoke tests son `continue-on-error`, así que un run verde no garantiza que el sitio renderice — si importa, mirar el log de esos pasos. Ojo que publica en el dominio real, no en un preview channel.

**Dónde sigue valiendo verificar antes** — esto no es fallar rápido, es perder datos:

- Escrituras masivas a Firestore desde `scripts/`, y cualquier borrado de documentos o de fotos en Storage.
- `git reset`, rebase, force push, borrar archivos o directorios.
- Secrets, `firestore.rules` / `storage.rules`, y el propio workflow de deploy.

## Contacto / Redes sociales (datos reales del sitio)

- WhatsApp: +54 9 11 7373-5757
- Email: bairesrentalok@gmail.com
- Instagram: @bairesrentalok
- Facebook: /profile.php?id=61566568521787

---

## Marca y negocio

Ver documentación completa:

- [`docs/negocio.md`](docs/negocio.md) — misión, propuesta de valor, planes/comisiones, público objetivo, métricas, flujo operativo
- [`docs/marca.md`](docs/marca.md) — tono de voz, paleta de colores, tipografía, logos ([`marketing/brand-guide.md`](marketing/brand-guide.md) tiene el detalle con snippets CSS)
- [`docs/marketing-canales.md`](docs/marketing-canales.md) — canales de contacto, tracking, estrategia de Meta Ads ([`marketing/estrategia-meta-ads.md`](marketing/estrategia-meta-ads.md))

Resumen rápido: tono cercano y profesional en voseo rioplatense (nunca tutear); color primario `--azul #1A6FE8`; tagline "Tu hogar, nuestro cuidado". Antes de citar precios/comisiones o métricas en contenido nuevo, confirmar contra `docs/negocio.md`.

---

## Carga de propiedades al catálogo

El catálogo vive en **Firestore**: colección `rentals` (alquiler temporario) y `sales` (venta). Escribir ahí publica en el sitio al instante — no hay commit ni deploy de por medio.

Hay dos caminos:

1. **El panel interno** (`/app/admin/rentals`, `/app/admin/sales`) — para ediciones puntuales desde el navegador.
2. **Los scripts de `scripts/`** — para importar desde Tokko/Tencery y para tareas masivas.

### Scripts disponibles

| Script | Uso |
|---|---|
| `scripts/add-from-ficha.js` | **El camino corto**: recibe la URL de una ficha —de ficha.info (Tokko) o de fichaprop.tech (Tencery)—, la lee y agrega la propiedad a `rentals` |
| `scripts/add-from-tokko.js` | Convierte un JSON de Tokko Broker al formato BairesRental y lo agrega a `rentals` |
| `scripts/add-from-tencery.js` | Lo mismo desde un JSON exportado de Tencery |
| `scripts/add-property.js` | Valida y agrega/actualiza una propiedad de alquiler ya en formato BairesRental |
| `scripts/add-property-venta.js` | Valida y agrega/actualiza una propiedad en venta |
| `scripts/upload-fotos.js` | Sube fotos locales a Firebase Storage y devuelve las URLs públicas |
| `scripts/check-ficha-links.js` | Solo lectura: audita fichas de Tokko caídas o cedidas a otra inmobiliaria |
| `scripts/resolve-map-coords.js` | Completa `lat`/`lng` para los pines del mapa |
| `scripts/fix-share-google-urls.js` | Repara `direccionUrl` con links `share.google` rotos |
| `scripts/backfill-revision.js` | Marca `revision: 'aprobada'` en las propiedades viejas (dry-run; escribe con `--apply`) |
| `scripts/reset-link-stats.js` | Deja en cero la actividad de los links de vendedores — contadores y eventos, nunca los leads (dry-run; escribe con `--apply`) |

Requieren Node.js y `npm install` en la raíz (usan `firebase-admin`). Las credenciales salen de `nuxt-app/serviceAccountKey.json` en local, o de la variable `FIREBASE_SERVICE_ACCOUNT` en CI — ver `scripts/lib/firestore.js`.

---

### Flujo 1: Import desde ficha.info (el camino corto)

El usuario pega la URL de la ficha para colegas y nada más. Guiado por el comando
`/agregar-depto-ficha`. El script entiende las dos fichas que usan las inmobiliarias con las que
trabajamos: `https://ficha.info/p/HASH?v=…` (Tokko) y `https://www.fichaprop.tech/ficha/UUID`
(Tencery).

ficha.info es una app Next.js que trae **el JSON completo de Tokko embebido en el HTML**, así que
una URL alcanza: el `id`, el precio, el barrio, el tipo, los amenities, la descripción, la portada
y las coordenadas del mapa salen todos de ahí. `scripts/lib/ficha.js` reconstruye ese payload y
`scripts/add-from-ficha.js` reusa el mapeo de `add-from-tokko.js`.

```
node scripts/add-from-ficha.js "<url>" --out scripts/temp-ficha.json   # revisar primero
node scripts/add-from-ficha.js "<url>" --id alq-06 --minimo 3 --sin-mascotas --yes
```

Flags de override: `--id`, `--precio`, `--minimo`, `--mascotas` / `--sin-mascotas`,
`--servicios` / `--sin-servicios`, `--barrio`, `--titulo`, `--imagen`, `--desde`, `--propio`.

**fichaprop.tech (Tencery)** es un SPA: el HTML viene vacío y los datos los pide el navegador a
Supabase. `scripts/lib/fichaprop.js` hace esas mismas dos requests con la clave publishable que
trae el bundle del sitio, y el schema que devuelve es el de Tencery, así que el mapeo lo hace
`tenceryToProperty()` de `add-from-tencery.js`. Lo que la ficha de Tencery da mejor que la de
Tokko: los servicios vienen listados uno por uno (de ahí sale `serviciosIncluidos`, que es luz +
wifi) y `pet_friendly` es un campo, no una frase en la descripción. Lo que da peor: las
coordenadas suelen ser el placeholder del Obelisco, así que el pin queda para
`resolve-map-coords.js`.

**De qué link salió queda guardado.** Todo lo que entra por un link —el script o el campo de
importar del panel— guarda `origen: { fuente, url, leidoEn }` en el documento, para poder volver a
leer la ficha y refrescar precio y disponibilidad más adelante. No alcanzaba con `fotos`: en
alquileres guarda la misma URL pero es editable, y en venta `fotos` son las fotos, así que el link
no quedaba en ningún lado. Por ahora no hay un script que lo consuma — refrescar es volver a correr
`add-from-ficha.js <url> --id <id> --update`. El formulario del panel muestra el link y lo reenvía
tal cual: no se edita a mano.

**Cada ficha tiene su serie de ids**, así el id dice de dónde salió la propiedad: `alq-NN` para lo
que entra por ficha.info (Tokko) y `tenc-NN` para lo de fichaprop.tech (Tencery). Se rellena el
primer número libre de la serie: se miran los docs de `rentals` cuyo id es exactamente
`<serie>-<dígitos>` y se busca el hueco más bajo (con `alq-01`… `alq-05` y `alq-07` ocupados, el
próximo es `alq-06`). Los ids históricos sucios (`alq-8315-`, `alq-PEDRO6767`, `alq-marie-11`) no
matchean y quedan afuera del conteo.

Lo que la ficha **no** dice y hay que preguntar: `mascotas`, `minimoMeses` y, a veces,
`serviciosIncluidos` y `esPropio`. El script los lista con ⚠️.

Lo mismo se puede hacer **sin Claude** desde el panel: `/app/rentals/new` tiene un campo para pegar
el link —de ficha.info o de fichaprop.tech—, que llama al callable `importFromFicha` y autocompleta
el formulario. `/app/sales/new` tiene el mismo campo para el catálogo de ventas y también acepta las
dos fichas — ver abajo.

---

### Flujo 2: Import desde Tokko Broker

El usuario obtiene el JSON de Tokko por su cuenta y lo pega directamente en el chat. Está guiado por el comando `/agregar-depto`.

**Pasos:**
1. Guardar el JSON en `scripts/temp-tokko.json`
2. Ejecutar: `node scripts/add-from-tokko.js scripts/temp-tokko.json`
3. El script muestra el mapeo completo y pide confirmación
4. Revisar con el usuario los campos marcados con ⚠️ antes de confirmar
5. Eliminar `scripts/temp-tokko.json` después de agregar

**Con `--out` para revisar antes de agregar:**
```
node scripts/add-from-tokko.js scripts/temp-tokko.json --out scripts/temp-mapped.json
# editar temp-mapped.json si hace falta, luego:
node scripts/add-property.js scripts/temp-mapped.json
```

**Mapeo Tokko → BairesRental:**

| Campo BairesRental | Fuente en Tokko |
|---|---|
| `id` | slug de `data.address` (ej: "bauness-1100") |
| `titulo` | Generado: "Monoambiente en Parque Chacabuco" |
| `barrio` | `data.location.split('\|')[0]` |
| `tipo` | `data.basic_info[room_amount]`: 1→monoambiente, 2→2 ambientes, 3→3 ambientes, 4+→4+ ambientes; si `data.type`=Casa→casa |
| `precio` | `hoggax_data.rent_prices[0].value` |
| `moneda` | `hoggax_data.rent_prices[0].currency` |
| `disponibilidad` | `tokko.active`: true→disponible, false→no disponible |
| `amueblado` | `data.additionals` o `data.tags` contiene "Amoblado" |
| `mascotas` | `data.tags` o descripción menciona "mascota" (confirmar con propietario) |
| `serviciosIncluidos` | **siempre false** (confirmar manualmente) |
| `minimoMeses` | **siempre 1** (confirmar manualmente) |
| `amenities` | Ver tabla abajo |
| `descripcion` | `data.description` sin HTML |
| `imagen` | `data.pictures.front_cover_image.url` (URL de Tokko CDN) |
| `fotos` | URL de ficha.info para colegas (la provee el usuario) |
| `fichaUrl` | Vacío — solo se usa para links directos de Airbnb o Booking |
| `direccion` | `data.address` |
| `direccionUrl` | Google Maps con `data.geolocation.lat/lng` |
| `esPropio` | **siempre false** |

**Amenities Tokko → BairesRental:**

| Tokko | BairesRental |
|---|---|
| Pileta / Piscina | `pileta` |
| Gimnasio / Gym | `gimnasio` |
| Laundry / Lavandería | `laundry` |
| Parrilla / Quincho | `parrilla` |
| Terraza / Rooftop | `terraza` |
| Cochera / Garaje / Estacionamiento | `cochera` |
| Sauna | `sauna` |
| Solarium / Solárium | `solárium` |
| Seguridad 24hs / Vigilancia / Portería | `seguridad 24hs` |
| Jacuzzi | `jacuzzi` |
| Lavarropas | `lavarropas` |

---

### Flujo 3: Import desde texto de PDF

El usuario pega texto extraído de un PDF (descripción de la propiedad) y puede adjuntar una foto.

**Pasos:**
1. Extraer todos los campos posibles del texto (ver schema abajo)
2. Si el usuario adjunta una foto → subirla con `node scripts/upload-fotos.js alquileres [id] <foto>` y usar la URL que devuelve
3. Construir el objeto JSON de la propiedad
4. Guardarlo en `scripts/temp-prop.json`
5. Ejecutar: `node scripts/add-property.js scripts/temp-prop.json`
6. Eliminar `scripts/temp-prop.json` después de agregar

**Schema completo de una propiedad de alquiler:**

```json
{
  "id": "slug-unico-del-depto",
  "titulo": "Descripción corta visible en el card",
  "barrio": "Nombre del barrio (CABA)",
  "tipo": "monoambiente | 2 ambientes | 3 ambientes | 4+ ambientes | casa",
  "precio": 0,
  "moneda": "USD | ARS",
  "disponibilidad": "disponible | reservado | no disponible",
  "disponibleDesde": "YYYY-MM-DD o vacío",
  "amueblado": true,
  "mascotas": false,
  "serviciosIncluidos": false,
  "minimoMeses": 1,
  "amenities": ["pileta","gimnasio","laundry","parrilla","terraza","cochera","sauna","solárium","seguridad 24hs","jacuzzi","lavarropas"],
  "descripcion": "Texto sin HTML",
  "imagen": "https://... ← URL de Storage, de Tokko CDN o de la plataforma",
  "fotos": "https://ficha.info/p/... ← ficha.info para colegas (o álbum Google Photos)",
  "fichaUrl": "https://airbnb.com/... ← solo para links directos de Airbnb o Booking (dejar vacío si hay ficha.info)",
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "lat": -34.6, "lng": -58.4,
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "esPropio": false,
  "revision": "aprobada"
}
```

Notas:
- `precio: 0` muestra "Consultar precio" en el card
- `serviciosIncluidos: true` = incluye luz **y** wifi
- Si hay `fichaUrl`, el botón "Ver detalle" abre esa URL en lugar de la ficha interna
- `lat`/`lng` son los pines del mapa. Si no los ponés, `scripts/resolve-map-coords.js` los completa después
- `origen` no se escribe a mano: lo sella el importador con el link del que salió la propiedad

---

### Manejo de imágenes

Las fotos viven en **Firebase Storage**, con el layout que declara `nuxt-app/storage.rules`: `rentals/<id>/<archivo>` y `sales/<id>/<archivo>`, de lectura pública.

| Caso | Acción |
|---|---|
| Usuario adjunta foto al chat | Guardarla en el scratchpad y subirla con `scripts/upload-fotos.js` |
| URL externa (Tokko CDN, Airbnb, etc.) | Usarla directamente (puede expirar si dan de baja el listado) |
| Link a álbum de Google Photos | Va al campo `fotos`, no en `imagen` |
| Sin imagen | Dejar `imagen: ""` (el card muestra un placeholder 📸) |

---

## Catálogo de ventas (colección `sales`)

Flujo **independiente** del de alquileres — propiedades en venta, con hasta **20 fotos** por ficha mostradas en una galería nativa (grid + lightbox a pantalla completa) en `/ventas/[id]`, en vez del link externo a álbum que usan los alquileres.

### Comando

`/agregar-depto-venta` — guía el flujo completo: recibe texto (PDF o descripción manual) + fotos adjuntadas en el chat, las sube a Storage, arma el JSON y lo agrega al catálogo.

### Alta pegando el link de una ficha

`/app/sales/new` tiene el mismo campo que `/app/rentals/new`: se pega el link para colegas —de Tokko
o de Tencery—, el callable `importFromFicha` (con `collectionName: 'sales'`) lee la ficha en el
server y completa el formulario. El mapeo de venta es `fichaToSale()` en
`nuxt-app/functions/src/ficha.ts` y `fichapropToSale()` en `functions/src/fichaprop.ts`.

**Una ficha de Tencery cargada como venta entra igual que una de alquiler**, con una salvedad: su
catálogo es de alquiler temporario y no tiene operación de venta, así que el `precio` queda en 0
("Consultar precio") y se carga a mano, lo mismo que ya hace `fichaToSale()` con una ficha de Tokko
sin operación de venta. La antigüedad y el apto crédito tampoco vienen. Todo lo demás sí: metros,
ambientes (dormitorios + 1), baños, expensas, amenities, descripción y las hasta 20 fotos. Los
avisos lo marcan uno por uno. El id sugerido es `tenc-NN` en los dos catálogos.

Lo que sale de la ficha y el alquiler no usa: `precio` (de `operations.Sale`, en formato "USD 120.000"),
`superficie` y `superficieCubierta` (de `measurement`), `ambientes` / `banios` / `antiguedad` /
`aptoCredito` (de `basic_info`) y `expensas` (de `operation_block_data`).

**Las fotos vienen también.** La ficha trae hasta 20 URLs del CDN de Tokko y entran como links
pendientes: al guardar, `importListingImage` las baja una por una a nuestro Storage, así la galería
nativa no queda colgada de un CDN ajeno. Son hasta 20 requests en serie — el botón va contando
("Copiando foto 3 de 19…") y puede tardar minutos con datos móviles.

El id que sugiere es `ven-NN`, la serie nueva (las series salen todas de `proximoIdDeSerie()`); los ids históricos (`lafinur-3000`, `poli-venta-01`)
no matchean y quedan afuera del conteo. Hay que confirmar a mano `aptoCredito` (Tokko casi siempre
dice "No especificado") y, si la ficha es de alquiler y no de venta, el precio: el aviso lo marca.

De la terminal esto **sólo existe para alquileres** (`scripts/add-from-ficha.js`): el camino de venta
necesita bajar y volver a subir hasta 20 fotos, que es justo lo que el panel ya hace.

### Schema de una propiedad en venta

```json
{
  "id": "slug-unico",
  "titulo": "Descripción corta visible en el card",
  "barrio": "Nombre del barrio (CABA)",
  "tipo": "monoambiente | 2 ambientes | 3 ambientes | 4+ ambientes | casa | PH",
  "precio": 0,
  "moneda": "USD | ARS",
  "disponibilidad": "disponible | reservado | vendido",
  "superficie": 0,
  "superficieCubierta": 0,
  "ambientes": 0,
  "banios": 0,
  "antiguedad": "A estrenar | número de años | vacío",
  "expensas": 0,
  "aptoCredito": false,
  "amueblado": false,
  "amenities": ["pileta","gimnasio","laundry","parrilla","terraza","cochera","sauna","solárium","seguridad 24hs","jacuzzi","lavarropas"],
  "descripcion": "Texto sin HTML",
  "fotos": ["https://firebasestorage.googleapis.com/... ", "... hasta 20"],
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "lat": -34.6, "lng": -58.4,
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "fichaUrl": "https://... (opcional — Zonaprop/Argenprop, botón secundario en la ficha)",
  "esPropio": false,
  "revision": "aprobada"
}
```

Notas:
- `superficie` es **obligatoria** (m² totales) — el script rechaza la carga sin ella; el catálogo la usa como filtro ("Superficie mín.")
- `precio: 0` muestra "Consultar precio"
- `fotos[0]` es la portada (catálogo + hero de la ficha); el resto arma la galería
- `disponibilidad: "vendido"` se mantiene para uso interno pero no se muestra en el catálogo público (igual que "no disponible" en alquileres)
- `fichaUrl` es opcional y solo agrega un botón secundario "Ver publicación completa" — no reemplaza la galería nativa
- Reutiliza el mismo catálogo de `amenities` que los alquileres
- `origen` no se escribe a mano: lo sella el importador con el link del que salió la propiedad

---

## Auditoría de fichas de Tokko

`scripts/check-ficha-links.js` recorre las fichas de ficha.info enlazadas en `rentals` y marca dos cosas: las que Tokko pasó a "No disponible" y las que aparecen bajo **otra inmobiliaria** (o sea, la propiedad se fue a otra agencia). Es de solo lectura.

Corre todos los lunes desde `.github/workflows/check-ficha-links.yml` y abre/actualiza un Issue con los IDs a revisar. A mano: `npm run catalogo:fichas`.
