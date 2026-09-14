# BairesRental

Sitio web estático para **BairesRental**, empresa de administración de alquileres temporarios en Buenos Aires (CABA), Argentina.

Documentación detallada del negocio, la marca y el catálogo en [`docs/`](docs/README.md) — este archivo cubre lo operativo (stack, estructura, convenciones, carga de propiedades).

## Stack

- HTML5 estático — sin build system, sin bundler, sin backend
- Bootstrap 5.3 (CDN) + Bootstrap Icons (CDN)
- Font Awesome 6 (CDN)
- jQuery + plugins locales: Flexslider, Owl Carousel, Magnific Popup, Waypoints, Stellar Parallax, countTo
- Google Fonts: Source Sans Pro, Roboto Slab
- CSS propio: `css/style.css` (principal), `css/pricing.css`

## Páginas

Inventario completo (incluyendo páginas internas para vendedores y el panel admin) en [`docs/sitio-paginas.md`](docs/sitio-paginas.md).

| Archivo | Sección |
|---|---|
| `index.html` | Home — hero, propuesta de valor, planes, calculadora de ingresos, reviews, contacto |
| `departamentos.html` / `departamento.html` | Catálogo de alquiler temporario / ficha de detalle de una propiedad |
| `ventas.html` / `detalle-venta.html` | Catálogo de departamentos en venta / ficha de detalle (galería + lightbox) |
| `catalogo-vendedores.html` / `ficha-vendedor.html` | Versión interna (`noindex`, sin WhatsApp) del catálogo/ficha de alquiler para agentes |
| `tickets.html` | Landing de "Baires-Football Experience" (negocio paralelo, redirige a sitio externo) |

No existe `faq.html` en el repo — no crear referencias a esa página salvo que se agregue explícitamente.

## Estructura de archivos

```
/
├── index.html, departamentos.html, departamento.html, ventas.html, detalle-venta.html, tickets.html
├── catalogo-vendedores.html, ficha-vendedor.html   # internas, noindex
├── admin/        # CMS local para editar data/*.json (ver docs/catalogo-datos.md)
├── css/          # Estilos locales (vendor + style.css propio)
├── js/           # Scripts locales (vendor + main.js propio)
├── images/       # Logos, carruseles, fotos de departamentos
├── fonts/        # Icomoon icon font
├── sass/         # Fuente SASS (si se edita style.css, compilar desde acá)
├── data/         # departamentos.json, ventas.json — nunca editar a mano
├── scripts/      # Scripts de carga/mantenimiento del catálogo
├── marketing/    # Brand guide y estrategia de Meta Ads
└── docs/         # Documentación detallada del negocio y la marca
```

## Convenciones

- Todo el contenido está en **español rioplatense** (vos/ustedes).
- Mantener coherencia visual con los colores y tipografías existentes en `css/style.css`.
- No introducir dependencias nuevas sin necesidad — preferir lo que ya está cargado.
- Los cambios de estilo van en `css/style.css`; no tocar los archivos vendor en `css/`.
- Para probar localmente: abrir `index.html` directamente en el navegador o levantar un servidor estático simple (`python -m http.server` o similar).

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

Resumen rápido: tono cercano y profesional en voseo rioplatense (nunca tutear); color primario `--azul #1A6FE8`; tagline "Tu hogar, nuestro cuidado". Antes de citar precios/comisiones o métricas en contenido nuevo, confirmar contra `docs/negocio.md` (ya incluye una corrección de comisión detectada en `index.html` vs. lo documentado antes).

---

## Carga de propiedades al catálogo

Las propiedades se almacenan en `data/departamentos.json` (array JSON). Por su tamaño, **nunca leer ni editar ese archivo directamente** — siempre usar los scripts de `scripts/`.

### Scripts disponibles

| Script | Uso |
|---|---|
| `scripts/add-from-tokko.js` | Convierte un JSON de Tokko Broker al formato BairesRental y lo agrega al catálogo |
| `scripts/add-from-tencery.js` | Convierte un JSON exportado de Tencery al formato BairesRental (ver [docs/catalogo-datos.md](docs/catalogo-datos.md)) |
| `scripts/add-property.js` | Valida y agrega un objeto ya en formato BairesRental al catálogo |
| `scripts/check-ficha-links.js` | Solo lectura: audita links de ficha.info (Tokko) caídos o cedidos a otra inmobiliaria |
| `scripts/fix-share-google-urls.js` | Repara `direccionUrl` con links `share.google` rotos |

Todos requieren Node.js (`node --version` para verificar). Hay además un panel admin local (`npm run dev` / `npm run dev:ventas`) para editar los catálogos sin JSON a mano — ver [docs/catalogo-datos.md](docs/catalogo-datos.md#panel-admin).

---

### Flujo 1: Import desde Tokko Broker

El usuario obtiene el JSON de Tokko por su cuenta y lo pega directamente en el chat.

**Pasos:**
1. Guardar el JSON en `scripts/temp-tokko.json`
2. Ejecutar: `node scripts/add-from-tokko.js scripts/temp-tokko.json`
3. El script muestra el mapeo completo y pide confirmación
4. Revisar con el usuario los campos marcados con ⚠️ antes de confirmar
5. Eliminar `scripts/temp-tokko.json` después de agregar
6. Hacer git add + commit

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

### Flujo 2: Import desde texto de PDF

El usuario pega texto extraído de un PDF (descripción de la propiedad) y puede adjuntar una foto.

**Pasos:**
1. Extraer todos los campos posibles del texto (ver schema abajo)
2. Si el usuario adjunta una foto → guardarla en `images/[id]/main.jpg`
3. Construir el objeto JSON de la propiedad
4. Guardarlo en `scripts/temp-prop.json`
5. Ejecutar: `node scripts/add-property.js scripts/temp-prop.json`
6. Eliminar `scripts/temp-prop.json` después de agregar
7. Hacer git add + commit

**Schema completo de una propiedad:**

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
  "imagen": "./images/[id]/main.jpg  ← local, o URL externa",
  "fotos": "https://ficha.info/p/... ← ficha.info para colegas (o álbum Google Photos)",
  "fichaUrl": "https://airbnb.com/... ← solo para links directos de Airbnb o Booking (dejar vacío si hay ficha.info)",
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "esPropio": false
}
```

Notas:
- `precio: 0` muestra "Consultar precio" en el card
- `serviciosIncluidos: true` = incluye luz **y** wifi
- Si hay `fichaUrl`, el botón "Ver detalle" abre esa URL en lugar del modal interno
- `imagen` puede ser URL externa (Tokko CDN, Airbnb, etc.) o path local relativo desde la raíz

---

### Manejo de imágenes

| Caso | Acción |
|---|---|
| Usuario adjunta foto al chat | Guardar en `images/[id]/main.jpg`, usar `./images/[id]/main.jpg` como `imagen` |
| URL externa (Tokko CDN, etc.) | Usar directamente como `imagen` (puede expirar si el listado se da de baja) |
| Link Google Photos | Va al campo `fotos`, no en `imagen` |
| Sin imagen | Dejar `imagen: ""` (el card muestra un placeholder 📸) |

---

## Catálogo de ventas (data/ventas.json)

Flujo **independiente** del de alquileres — propiedades en venta, con hasta **20 fotos** por ficha mostradas en una galería nativa (grid + lightbox a pantalla completa) en `detalle-venta.html`, en vez del link externo a álbum que usan los alquileres.

Por su tamaño, **nunca leer ni editar `data/ventas.json` directamente** — siempre usar `scripts/add-property-venta.js`.

### Comando

`/agregar-depto-venta` — guía el flujo completo: recibe texto (PDF o descripción manual) + fotos adjuntadas en el chat, guarda las fotos en `images/ventas/[id]/1.jpg…N.jpg`, arma el JSON y lo agrega al catálogo.

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
  "fotos": ["./images/ventas/[id]/1.jpg", "... hasta 20"],
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/...",
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "fichaUrl": "https://... (opcional — Zonaprop/Argenprop, botón secundario en la ficha)",
  "esPropio": false
}
```

Notas:
- `superficie` es **obligatoria** (m² totales) — el script rechaza la carga sin ella; el catálogo la usa como filtro ("Superficie mín.")
- `precio: 0` muestra "Consultar precio"
- `fotos[0]` es la portada (catálogo + hero de la ficha); el resto arma la galería
- `disponibilidad: "vendido"` se mantiene en el JSON para uso interno pero no se muestra en el catálogo público (igual que "no disponible" en alquileres)
- `fichaUrl` es opcional y solo agrega un botón secundario "Ver publicación completa" — no reemplaza la galería nativa
- Reutiliza el mismo catálogo de `amenities` que los alquileres

### Archivos involucrados

| Archivo | Rol |
|---|---|
| `data/ventas.json` | Catálogo de propiedades en venta |
| `scripts/add-property-venta.js` | Valida y agrega/actualiza una propiedad |
| `js/ventas.js` | Filtros y renderizado de cards en `ventas.html` |
| `ventas.html` | Catálogo público con filtros (barrio, tipo, precio, apto crédito, amenities) |
| `detalle-venta.html` | Ficha de detalle con galería de fotos + lightbox |
