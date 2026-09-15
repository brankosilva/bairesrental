# Catálogo y datos

Las propiedades viven en dos archivos JSON grandes. **Nunca leerlos ni editarlos directamente** — usar siempre los scripts de `scripts/` (o el panel admin local). Ver también el skill `agregar-depto` y `/agregar-depto-venta`, y las instrucciones de carga en `CLAUDE.md`.

## `data/departamentos.json` — alquileres

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
  "imagen": "./images/[id]/main.jpg  (local) o URL externa",
  "fotos": "URL de ficha.info o álbum Google Photos",
  "fichaUrl": "solo para links directos de Airbnb/Booking (vacío si hay ficha.info)",
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/... o google.com/maps/search",
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "esPropio": false
}
```

Notas: `precio: 0` muestra "Consultar precio". `serviciosIncluidos: true` = incluye luz **y** wifi. Si hay `fichaUrl`, el botón "Ver detalle" abre esa URL en vez del modal/ficha interna.

## `data/ventas.json` — ventas

Flujo **independiente** del de alquileres. Hasta 20 fotos por ficha, mostradas en galería nativa + lightbox en `detalle-venta.html` (en vez del link externo a álbum que usan los alquileres).

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
  "fotos": ["./images/ventas/[id]/1.jpg", "... hasta 20"],
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "fichaUrl": "opcional — Zonaprop/Argenprop, botón secundario",
  "esPropio": false
}
```

Notas: `superficie` es **obligatoria** (el script rechaza la carga sin ella; se usa como filtro "Superficie mín."). `fotos[0]` es la portada. `disponibilidad: "vendido"` se guarda para uso interno pero no se muestra en el catálogo público.

## Scripts de carga (`scripts/`)

Todos requieren Node.js (`node --version`).

| Script | Uso |
|---|---|
| `add-from-tokko.js` | Convierte un JSON de Tokko Broker al formato BairesRental y lo agrega a `data/departamentos.json`. Ver mapeo completo en `CLAUDE.md`. |
| `add-from-tencery.js` | Convierte un JSON exportado de **Tencery** (otra plataforma de gestión) al formato BairesRental. Mapea ambientes→tipo, extrae amenities/mascotas/mínimo de estadía de la descripción libre, detecta duplicados (mismo id/dirección/foto) y pide confirmación antes de escribir. Flags: `--yes`, `--dry-run`, `--out`, `--fotos`. |
| `add-property.js` | Valida y agrega un objeto ya en formato BairesRental a `data/departamentos.json`. |
| `add-property-venta.js` | Valida y agrega/actualiza una propiedad en `data/ventas.json` (usado por el skill `/agregar-depto-venta`). |
| `check-ficha-links.js` | Solo lectura: recorre todas las URLs de `ficha.info` (Tokko) en `data/departamentos.json` y avisa cuáles Tokko ya muestra como inactivas o cedidas a otra inmobiliaria (detecta listados perdidos ante la competencia). No modifica el catálogo; puede exportar el reporte a JSON. |
| `fix-share-google-urls.js` | Reparación puntual: busca propiedades con `direccionUrl` roto (links cortos `share.google`) y los reemplaza por URLs `google.com/maps/search` construidas desde `direccion`. Flags `--dry-run`/`--yes`. |

## Panel admin

Local, no público — es el CMS para editar los dos catálogos sin tocar JSON/git a mano.

| Comando | Sirve | Puerto | Archivo de datos |
|---|---|---|---|
| `npm run dev` | `admin/index.html` (alquileres) | 3001 | `data/departamentos.json` |
| `npm run dev:ventas` | `admin/ventas.html` (ventas) | 3002 | `data/ventas.json` |

`admin/server.js` y `admin/server-ventas.js` son servidores Node `http` sin dependencias (CORS abierto, protección básica contra path traversal) que exponen:
- `GET /api/departamentos` (o `/api/ventas`) — devuelve el array completo.
- `PUT` al mismo path — sobreescribe el archivo completo (no hay diffing por registro).
- `POST /api/upload` (header `X-Depto-Id`) / `POST /api/upload-venta` (header `X-Venta-Id`) — sube imágenes a `images/<id>/imagen.ext` (alquileres, una sola imagen, se sobreescribe) o `images/ventas/<id>/foto-<timestamp>-<rand>.ext` (ventas, hasta ~20 fotos acumuladas).

La UI (sidebar con buscador/filtros por tipo y disponibilidad + formulario de edición a la derecha) permite crear/editar/eliminar propiedades y subir fotos sin tocar JSON, con botones "Exportar/Importar JSON". Después de usarlo, los cambios en `data/*.json` e `images/` se commitean a git como cualquier otro cambio — el admin no hace commits por sí solo.
