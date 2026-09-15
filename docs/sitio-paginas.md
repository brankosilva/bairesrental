# Páginas del sitio

Inventario completo verificado contra el HTML real (2026-09-12). `faq.html` **no existe** en el repo pese a haber sido mencionado en una versión previa de `CLAUDE.md` — no citarlo hasta que se cree.

## Públicas

| Archivo | Sección | Notas |
|---|---|---|
| `index.html` | Home — hero, propuesta de valor, planes, calculadora de ingresos, testimonios, reviews de huéspedes, premios, formulario de contacto, footer | Ver [negocio.md](negocio.md) para el copy completo |
| `departamentos.html` | Catálogo de alquiler temporario, con filtros (barrio, tipo, precio máx. USD 500–8.000, amueblado, mascotas, "solo BairesRental", disponibilidad, amenities) | Cards renderizadas por `js/departamentos.js` desde `data/departamentos.json`; link a `docs/requisitos-alquiler.pdf` |
| `departamento.html` | Ficha de detalle de **una** propiedad en alquiler (`?id=...`) | Imagen única (sin galería/lightbox), botón WhatsApp con mensaje pre-completado, "Ver todas las fotos" abre álbum externo (Google Photos / ficha.info) en pestaña nueva |
| `ventas.html` | Catálogo de departamentos en venta, con filtros propios (agrega tipo "PH", precio USD 30.000–500.000, superficie mín. 0–300 m², "apto crédito"; no tiene filtros de amueblado/mascotas) | Renderizado por `js/ventas.js` desde `data/ventas.json` |
| `detalle-venta.html` | Ficha de detalle de una propiedad en venta (`?id=...`) | Galería nativa (collage + lightbox a pantalla completa, hasta 20 fotos), campos extra vs. alquiler: ambientes, superficie total/cubierta, baños, antigüedad, apto crédito, expensas; estado puede ser "vendido" |
| `tickets.html` | Landing "Baires-Football Experience" (venta de entradas de fútbol) | Negocio paralelo sin catálogo propio; único CTA redirige a `https://baires-football.com/` (externo) |

## Internas / no indexadas (para vendedores/agentes)

| Archivo | Sección | Notas |
|---|---|---|
| `catalogo-vendedores.html` | Catálogo cerrado de alquileres para agentes/vendedores | Mismos datos y filtros que `departamentos.html`, pero `noindex,nofollow`, sin links de navegación, y `window.BR_VENDOR_MODE = true` suprime los botones de WhatsApp (el agente no debe direccionar tráfico al WhatsApp de BairesRental) |
| `ficha-vendedor.html` | Ficha de detalle para vendedores (`?id=...`) | Espejo de `departamento.html` sin nav, sin WhatsApp; `noindex,nofollow`; el botón "volver" apunta a `catalogo-vendedores.html` |

## Panel de administración (local, no público)

Ver [catalogo-datos.md](catalogo-datos.md#panel-admin) para el detalle del CMS local (`admin/`).

## Archivos de configuración/SEO

- `sitemap.xml` — solo 4 URLs (`/`, `/departamentos.html`, `/ventas.html`, `/tickets.html`); está desactualizado, no incluye `detalle-venta.html` ni `departamento.html`. Las páginas internas (`catalogo-vendedores.html`, `ficha-vendedor.html`, `admin/*`) están correctamente excluidas.
- `CNAME` — dominio `www.bairesrental.com.ar` (sitio servido vía GitHub Pages).
- Tracking en `index.html`: Meta Pixel `1704524150703684` (solo dispara `PageView`, sin eventos de conversión — ver [marketing-canales.md](marketing-canales.md)) y GA4 `G-3Q9QZ52W03`.
