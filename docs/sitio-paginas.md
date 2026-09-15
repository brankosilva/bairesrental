# Páginas del sitio

Inventario de las rutas de la app Nuxt (`nuxt-app/`), que es el sitio vivo en `www.bairesrental.com.ar`.

> **Histórico.** Hasta septiembre de 2026 esto listaba los `.html` de la raíz del repo (`index.html`, `departamentos.html`, `catalogo-vendedores.html`, etc.), servidos por GitHub Pages. Ese sitio se dio de baja y los archivos se borraron; quedan en el historial de git. Las URLs viejas redirigen con 301 — ver los `redirects` de `nuxt-app/firebase.json` y `nuxt-app/server/routes/`.

## Públicas

| Ruta | Sección | Notas |
|---|---|---|
| `/` | Home — hero, propuesta de valor, planes, calculadora de ingresos, testimonios, reviews de huéspedes, premios, formulario de contacto, footer | Ver [negocio.md](negocio.md) para el copy completo |
| `/departamentos` | Catálogo de alquiler temporario, con filtros (barrio, tipo, precio máx. USD 500–8.000, amueblado, mascotas, "solo BairesRental", disponibilidad, amenities) | Los filtros están colapsados detrás del botón "Filtrar", estilo Airbnb. Toggle **Lista / Mapa**: el mapa es Leaflet + OpenStreetMap y usa `lat`/`lng` de cada propiedad |
| `/departamentos/[id]` | Ficha de detalle de una propiedad en alquiler | Imagen única (sin galería), botón WhatsApp con mensaje pre-completado, "Ver todas las fotos" abre álbum externo (Google Photos / ficha.info) |
| `/ventas` | Catálogo de departamentos en venta, con filtros propios (agrega tipo "PH", precio USD 30.000–500.000, superficie mín. 0–300 m², "apto crédito"; sin filtros de amueblado/mascotas) | Mismos filtros colapsables y mismo toggle Lista/Mapa que alquileres |
| `/ventas/[id]` | Ficha de detalle de una propiedad en venta | Galería nativa (grid + lightbox a pantalla completa, hasta 20 fotos), campos extra vs. alquiler: ambientes, superficie total/cubierta, baños, antigüedad, apto crédito, expensas; estado puede ser "vendido" |
| `/tickets` | Landing "Baires-Football Experience" (venta de entradas de fútbol) | Negocio paralelo sin catálogo propio; único CTA redirige a `https://baires-football.com/` (externo) |
| `/l/[code]` · `/l/[code]/[propertyId]` | Links rastreables que generan los vendedores para compartir con clientes | Registran la visita y redirigen a la ficha |

## Modo vendedor

No son páginas aparte: es el parámetro **`?vendor=1`** sobre las rutas públicas (`/departamentos?vendor=1`, `/departamentos/[id]?vendor=1`). Suprime los botones de WhatsApp (el agente no debe direccionar tráfico al WhatsApp de BairesRental), deja el nav en logo + idioma y marca la página `noindex, nofollow`. Reemplaza a los viejos `catalogo-vendedores.html` y `ficha-vendedor.html`. Ver `nuxt-app/app/composables/useVendorMode.ts`.

## Panel interno (requiere login)

| Ruta | Rol | Contenido |
|---|---|---|
| `/app/login` · `/app/dashboard` | todos | Acceso y home del panel |
| `/app/admin/rentals` · `/app/admin/sales` | admin | ABM de los catálogos (alternativa por navegador a los scripts de `scripts/`) |
| `/app/admin/users` · `/app/admin/links` | admin | Usuarios y roles; links rastreables |
| `/app/seller/listings` · `/leads` · `/links` · `/profile` | vendedor | Sus propiedades, sus consultas, sus links, su ficha pública |
| `/app/owner` | propietario | Vista del propietario |
| `/app/rentals/[id]` · `/app/sales/[id]` | admin/vendedor | Edición de una propiedad |

Los permisos se resuelven en `nuxt-app/app/middleware/auth.ts` y en `firestore.rules` / `storage.rules`.

## Configuración / SEO

- **Sitemap**: lo genera la app en `/sitemap_index.xml` (módulo `@nuxtjs/sitemap`). El `sitemap.xml` estático de la raíz ya no existe.
- **Dominio**: `www.bairesrental.com.ar` → CNAME a `bairesrental.web.app` (Firebase Hosting). El `CNAME` de GitHub Pages se eliminó.
- **Tracking** en la home: Meta Pixel `1704524150703684` (solo `PageView`, sin eventos de conversión — ver [marketing-canales.md](marketing-canales.md)) y GA4 `G-3Q9QZ52W03`.
