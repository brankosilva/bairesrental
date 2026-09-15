# Catálogo y datos

El catálogo vive en **Firestore**: colección `rentals` (alquiler temporario) y `sales` (venta). Escribir ahí publica en el sitio al instante — `www.bairesrental.com.ar` lee Firestore en cada request (SSR).

Se edita de dos maneras: el panel interno (`/app/admin/rentals`, `/app/admin/sales`) o los scripts de `scripts/`. Ver también los comandos `/agregar-depto` y `/agregar-depto-venta`, y las instrucciones de carga en `CLAUDE.md`.

> **Histórico.** Hasta septiembre de 2026 el catálogo eran dos archivos JSON en `data/`, que alimentaban el sitio estático de la raíz del repo. Ese sitio se dio de baja y los JSON se borraron: para entonces ya estaban desactualizados respecto de Firestore. Quedan en el historial de git.

## `rentals` — alquileres

Schema por propiedad:

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
  "imagen": "URL de Firebase Storage (rentals/<id>/cover.jpg) o URL externa",
  "fotos": "URL de ficha.info o álbum Google Photos",
  "fichaUrl": "solo para links directos de Airbnb/Booking (vacío si hay ficha.info)",
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/... o google.com/maps/search",
  "lat": -34.6, "lng": -58.4,
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "esPropio": false
}
```

Notas: `precio: 0` muestra "Consultar precio". `serviciosIncluidos: true` = incluye luz **y** wifi. Si hay `fichaUrl`, el botón "Ver detalle" abre esa URL en vez de la ficha interna. `lat`/`lng` son el pin del mapa del catálogo; los completa `resolve-map-coords.js`.

## `sales` — ventas

Flujo **independiente** del de alquileres. Hasta 20 fotos por ficha, mostradas en galería nativa + lightbox en `/ventas/[id]` (en vez del link externo a álbum que usan los alquileres).

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
  "fotos": ["https://firebasestorage.googleapis.com/... (sales/<id>/1.jpg)", "... hasta 20"],
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "lat": -34.6, "lng": -58.4,
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "fichaUrl": "opcional — Zonaprop/Argenprop, botón secundario",
  "esPropio": false
}
```

Notas: `superficie` es **obligatoria** (el script rechaza la carga sin ella; se usa como filtro "Superficie mín."). `fotos[0]` es la portada. `disponibilidad: "vendido"` se guarda para uso interno pero no se muestra en el catálogo público.

## Scripts de carga (`scripts/`)

Todos requieren Node.js y `npm install` en la raíz (usan `firebase-admin`). Las credenciales salen de `nuxt-app/serviceAccountKey.json` en local, o de la variable de entorno `FIREBASE_SERVICE_ACCOUNT` en CI — ver `scripts/lib/firestore.js`. El acceso al catálogo está centralizado en `scripts/lib/catalogo.js`.

| Script | Uso |
|---|---|
| `add-from-tokko.js` | Convierte un JSON de Tokko Broker al formato BairesRental y lo agrega a `rentals`. Ver mapeo completo en `CLAUDE.md`. |
| `add-from-tencery.js` | Convierte un JSON exportado de **Tencery** (otra plataforma de gestión) al formato BairesRental. Mapea ambientes→tipo, extrae amenities/mascotas/mínimo de estadía de la descripción libre, detecta duplicados (mismo id/dirección/foto) y pide confirmación antes de escribir. Flags: `--yes`, `--dry-run`, `--out`, `--fotos`. |
| `add-property.js` | Valida y agrega/actualiza un objeto ya en formato BairesRental en `rentals`. |
| `add-property-venta.js` | Valida y agrega/actualiza una propiedad en `sales` (usado por el comando `/agregar-depto-venta`). |
| `upload-fotos.js` | Sube fotos locales a Firebase Storage (`rentals/<id>/`, `sales/<id>/`) y devuelve las URLs públicas listas para pegar en `imagen` o `fotos`. |
| `check-ficha-links.js` | Solo lectura: recorre todas las URLs de `ficha.info` (Tokko) del catálogo y avisa cuáles Tokko ya muestra como inactivas o cedidas a otra inmobiliaria (detecta listados perdidos ante la competencia). No modifica el catálogo; puede exportar el reporte a JSON con `--json`. Corre todos los lunes desde `.github/workflows/check-ficha-links.yml`. |
| `resolve-map-coords.js` | Completa `lat`/`lng` para los pines del mapa: saca las coordenadas del link de Google Maps (siguiendo los redirects de `maps.app.goo.gl`) y, si no hay, geocodifica la dirección con Nominatim. Por defecto solo escribe un reporte en `scripts/temp-coords.json`; con `--apply` guarda en Firestore. Los pines que ningún geocoder resuelve bien (esquinas, calles homónimas) se fijan a mano en `scripts/coords-manuales.json`, que tiene prioridad sobre todo lo demás. |
| `fix-share-google-urls.js` | Reparación puntual: busca propiedades con `direccionUrl` roto (links cortos `share.google`) y los reemplaza por URLs `google.com/maps/search` construidas desde `direccion`. Flags `--dry-run`/`--yes`. |

## Fotos

Viven en **Firebase Storage**, con el layout que declara `nuxt-app/storage.rules`:

- `rentals/<id>/<archivo>` — portada de un alquiler
- `sales/<id>/<archivo>` — hasta 20 fotos de una venta, en orden (`1.jpg`, `2.jpg`, …); la primera es la portada

Son de lectura pública (`allow read: if true`), así que la URL de descarga sirve directo en el catálogo. Escriben los admins (Admin SDK, o sea `scripts/upload-fotos.js`) y los vendedores a través de la Cloud Function `uploadListingImage`, que verifica la propiedad del listado del lado del servidor.

Reemplaza la vieja convención de guardar las fotos en `images/<id>/` dentro del repo, que murió con el sitio estático.

## Panel interno

El CMS del navegador es parte de la app Nuxt y requiere login con rol `admin`:

| Ruta | Sirve |
|---|---|
| `/app/admin/rentals` | ABM del catálogo de alquileres |
| `/app/admin/sales` | ABM del catálogo de ventas |

Reemplaza al viejo panel local de `admin/` (dos servidores Node que editaban `data/*.json` y se levantaban con `npm run dev` / `npm run dev:ventas`), eliminado junto con el sitio estático. A diferencia de aquel, escribe directo en Firestore: no hay paso de commit para publicar.
