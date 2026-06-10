# BairesRental — Brand Guide

Referencia visual y de componentes para el desarrollo del sitio `bairesrental.com.ar`. Basado en el CSS actual y los assets de `/images/`.

---

## Paleta de colores

### Variables CSS (nuevo sistema — `index.html` inline + catálogo)

Estas variables están definidas en el `<style>` inline de `index.html` y en el bloque `:root` del catálogo en `css/style.css`.

| Variable | Hex | Uso |
|---|---|---|
| `--azul` | `#1A6FE8` | Color primario — CTAs, acentos, links activos, badges |
| `--azul-dark` | `#1058c0` | Hover de botones primarios |
| `--negro` | `#111111` | Fondos oscuros (hero, navbar scrolled, stats, footer) |
| `--verde` | `#25D366` | Botones WhatsApp, checkmarks de éxito |
| `--blanco` | `#ffffff` | Texto sobre fondos oscuros, fondos de cards |
| `--gris` | `#f4f4f6` | Fondos de secciones claras, fondo body alt |
| `--gris2` | `#e8e8ec` | Bordes suaves, separadores |
| `--texto-gris` | `#6b7280` | Texto secundario, metadatos, placeholders |
| `--radius` | `16px` | Radio por defecto de cards y modales |

### Variables del catálogo (`--br-*`)

Definidas en el bloque `:root` al final de `css/style.css` (línea ~3136).

| Variable | Valor | Uso |
|---|---|---|
| `--br-azul` | `#1A6FE8` | Primario catálogo |
| `--br-azul-h` | `#155cc4` | Hover primario catálogo |
| `--br-verde` | `#25D366` | Botón WhatsApp |
| `--br-verde-h` | `#1ebe5b` | Hover WhatsApp |
| `--br-gris-bg` | `#f7f7f8` | Fondo de pills, tags, filtros |
| `--br-gris-borde` | `#e4e4e7` | Bordes de inputs, cards, separadores |
| `--br-gris-txt` | `#6b7280` | Texto secundario |
| `--br-radio` | `12px` | Radio de cards en catálogo |
| `--br-sombra` | `0 2px 16px rgba(0,0,0,0.08)` | Sombra default de card |
| `--br-sombra-h` | `0 8px 32px rgba(0,0,0,0.15)` | Sombra hover de card |
| `--br-card-img-h` | `210px` | Altura de imagen en card catálogo |

### Colores legacy (`css/style.css` — secciones antiguas)

Estas aparecen en el CSS heredado. **No usar para componentes nuevos** — usar `#1A6FE8` en su lugar.

| Hex | Contexto |
|---|---|
| `#2D6CDF` | Azul primario legacy (botones, links, íconos hover) |
| `#184cad` / `#437be2` | Hover/variante del azul legacy |
| `#222` | Footer background |
| `#828282` | Texto body legacy |
| `#ffd832` | Estrellas de reseñas |
| `#003580` | Azul Booking.com (sección awards) |

### Colores de estado (badges/disponibilidad)

| Estado | Background | Texto |
|---|---|---|
| Disponible | `#16a34a` (verde) | `#fff` |
| Reservado | `#d97706` (naranja) | `#fff` |
| No disponible | `#dc2626` (rojo) | `#fff` |
| BairesRental (propio) | `#1A6FE8` (azul) | `#fff` |

---

## Tipografía

### Fuente principal (nuevo sistema)

**DM Sans** — Google Fonts  
`family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800`

Pesos disponibles: 300, 400, 500, 600, 700, 800  
Usar para todo contenido nuevo: navbar, catálogo, filtros, modales, botones, cuerpo de texto.

### Fuentes legacy (secciones heredadas)

| Fuente | Uso en legacy |
|---|---|
| `Source Sans Pro` | Cuerpo de texto (`body`), navbar old, subtítulos hero |
| `Roboto Slab` | Headings (`h1–h6`), footer, contadores, form titles |
| `icomoon` | Icon font local (`/fonts/icomoon/`) |

### Escala tipográfica (CSS actual)

| Elemento | Tamaño | Peso | Notas |
|---|---|---|---|
| `h1` hero | `34px` desktop / `30px` mobile | 300 | Slider hero |
| `h2` sección | `2rem` (32px) | 400 | Roboto Slab |
| `h3` | `1.5rem` (24px) | 400 | Roboto Slab |
| Nav links | `10.5px` | 600 | Uppercase, `letter-spacing: 0.08em` |
| Nav CTA | `0.8rem` | 700 | |
| Body | `15px` | 400 | `line-height: 1.7` |
| `p` | `14px` | 400 | `line-height: 2rem` |
| Card título | `1.05rem` | 700 | DM Sans |
| Card precio | `1.3rem` | 700 | |
| Filter label | `0.8rem` | 700 | Uppercase, `letter-spacing: 0.06em` |
| Badge | `0.76rem` | 700 | |

---

## Logos y assets

### Logos disponibles (`/images/`)

| Archivo | Variante | Uso recomendado |
|---|---|---|
| `bairesrentallogoblanco.png` | Blanco | Navbar y footer (sobre fondos oscuros `#111`) |
| `bairesrental-high-resolution-logo.png` | Color, alta res | Documentos, presentaciones |
| `bairesrental-high-resolution-logo-black.png` | Negro, alta res | Sobre fondos blancos/claros |
| `bairesrentallogoredes.png` | Versión redes | Perfil de Instagram, Facebook |
| `logo-perfin-redes.png` | Alternativa redes | Perfil social |

Tamaño en navbar: `height: 34px` (nuevo sistema) / `max-width: 14rem` (sistema legacy).

### Imágenes de plataformas

| Archivo | Uso |
|---|---|
| `airbnb-logo-p.png`, `airbnb.png` | Logo Airbnb |
| `booking-logo-p.png`, `booking (1).png` | Logo Booking.com |
| `wp1.png`, `wp-p.png` | Logo WhatsApp |

### Premios y reconocimientos

| Archivo | Descripción |
|---|---|
| `Digital-Award-TRA-2025.png` | Traveller Review Award 2025 (Booking.com) |
| `Digital-Frame-TRA-2025.png` | Frame decorativo del award |
| `superhost-card.png` | Tarjeta Superhost Airbnb 2026 |
| `superhost-logo.png` | Logo Superhost |

### Imágenes de fondo / hero

| Archivo | Uso |
|---|---|
| `carrusel-1.jpg`, `carrusel-1b.jpg`, `carrusel-2.jpg`, `carrusel-3.jpg` | Slides del hero |
| `estadisticas.jpg` | Sección contadores (parallax) |
| `fondodepartments1.jpg`, `fongo-departments-page.jpg` | Hero página departamentos |
| `galeria-1.jpg` … `galeria-7.jpg` | Galería general |
| `fondo-reseña-casa.jpg` | Fondo sección reseñas |

### Fotos de departamentos (`/images/`)

Cada propiedad tiene su carpeta con `imagen.jpg` o `imagen.png`:

```
beruti-2390/          beruti-2390-B/        casa-duggan/
julian-alvarez-1509/  lima-1125/            medrano-828/
medrano-828-sunset/   Baires-3/             Teodoro-garcia/
teodoro-garcia-2500/  vera-0/ … vera-19/    (y variantes)
```

Imágenes del catálogo de barrios (para cards genéricos de zona):
```
images/catalogo/almagro.jpg
images/catalogo/belgrano.jpg
images/catalogo/canitas.jpg
images/catalogo/palermo.jpg
images/catalogo/puertomadero.jpg
images/catalogo/villaurquiza.jpg
```

### Perfiles de huéspedes (`/images/perfiles/`)

```
Bettina.jpg  Bruno G.jpg  Vero v.jpg  esteban.jpg
flor H.jpg   gabriela.jpg javier.jpg
```

### Banderas (`/images/banderas/`)

`Ar.png`, `Br.png`, `In.png`, `Uy.png`, `alemania.png`, `ch.png`, `col.png`, `par.png`, `us.png`

---

## Componentes

### Botones

#### Botón primario (nuevo sistema)
```css
background: var(--azul);        /* #1A6FE8 */
color: #fff;
border-radius: 100px;           /* pill */
padding: 0.55rem 1.2rem;
font-size: 0.8rem; font-weight: 700;
transition: background 0.2s, transform 0.15s;

:hover {
  background: var(--azul-dark); /* #1058c0 */
  transform: translateY(-1px);
}
```

#### Botón WhatsApp
```css
background: var(--br-verde);    /* #25D366 */
color: #fff;
border: none; border-radius: 8px;
padding: 0.65rem 1rem;
font-weight: 600;

:hover { background: var(--br-verde-h); /* #1ebe5b */ }
```

#### Botón outline / secundario (catálogo)
```css
background: transparent;
color: #111;
border: 1.5px solid var(--br-gris-borde);
border-radius: 8px;
padding: 0.55rem 1rem;

:hover { border-color: #111; background: var(--br-gris-bg); }
```

#### Pills de filtro
```css
background: var(--br-gris-bg);
border: 1.5px solid var(--br-gris-borde);
border-radius: 20px;
padding: 0.38rem 0.82rem;
font-size: 0.88rem; font-weight: 500;

.active { background: var(--br-azul); border-color: var(--br-azul); color: #fff; }
```

#### CTA del hero (legacy)
```css
background: #2D6CDF;
color: #fff;
padding: 16px 26px;
font-size: 12px;
text-transform: uppercase; letter-spacing: 2px;
border-radius: 5px;

:hover { background: #184cad; }
```

---

### Cards de propiedades (catálogo)

```css
.br-prop-card {
  background: #fff;
  border-radius: var(--br-radio);   /* 12px */
  border: 1px solid var(--br-gris-borde);
  box-shadow: var(--br-sombra);     /* 0 2px 16px rgba(0,0,0,0.08) */
  overflow: hidden;
  transition: box-shadow 0.25s, transform 0.25s;
}

:hover {
  box-shadow: var(--br-sombra-h);   /* 0 8px 32px rgba(0,0,0,0.15) */
  transform: translateY(-3px);
}
```

Estructura de la card:
1. Imagen: `height: 210px`, `object-fit: cover`
2. Badges de disponibilidad (top-left, absolutos)
3. Body: barrio, título, precio, amenities, descripción, acciones

---

### Modal de detalle

```css
#detalle-modal {
  border-radius: 16px;
  max-height: 88vh;
  box-shadow: 0 24px 64px rgba(0,0,0,0.25);
  backdrop-filter: blur(4px) en el overlay;
}
/* Mobile: bottom sheet con border-radius: 12px 12px 0 0 */
```

---

### Badges

| Clase | Color BG | Color texto | Uso |
|---|---|---|---|
| `.br-badge-propio` | `#1A6FE8` | `#fff` | Propiedad de BairesRental |
| `.br-badge-disponible` | `#16a34a` | `#fff` | Disponible |
| `.br-badge-reservado` | `#d97706` | `#fff` | Reservado |
| `.br-badge-nodisponible` | `#dc2626` | `#fff` | No disponible |

```css
.br-badge {
  font-size: 0.76rem; font-weight: 700;
  padding: 0.25rem 0.6rem; border-radius: 6px;
  letter-spacing: 0.01em;
}
```

---

### Tags inline (precio/condiciones)

| Clase | Color BG | Texto | Significado |
|---|---|---|---|
| `.br-tag-servicios` | `#dcfce7` | `#14532d` | Servicios incluidos |
| `.br-tag-servicios-aparte` | `#fee2e2` | `#dc2626` | Servicios aparte |
| `.br-tag-minimo` | `#fef3c7` | `#92400e` | Mínimo de meses |

---

### Navbar (nuevo sistema)

```css
/* Transparente sobre hero */
.nav {
  position: fixed; top: 0;
  padding: 1.2rem 2rem;
  background: transparent;
}

/* Scrolled */
.nav.scrolled {
  background: rgba(17,17,17,0.96);
  backdrop-filter: blur(12px);
  padding: 0.8rem 2rem;
  box-shadow: 0 1px 0 rgba(255,255,255,0.08);
}
```

Logo en navbar: `bairesrentallogoblanco.png`, `height: 34px`.

---

### Footer

```css
.footer {
  background-color: #222;
  color: #7e7e7e;
  font-family: "Roboto Slab", serif;
}
/* Grid 3 columnas en desktop, 1 columna en mobile ≤670px */
.footer-container { grid-template-columns: 1fr 1fr 1fr; gap: 3rem; }
```

Logo en footer: `bairesrentallogoblanco.png`, `max-width: 150px`.  
Links: color `#7e7e7e` → hover `#2D6CDF`.

---

### Sección de contadores / stats

```css
.fh5co-counters {
  background con parallax (background-attachment: fixed);
  overlay: rgba(0,0,0,0.5);
  padding: 4rem 0;
}
.fh5co-counter {
  font-size: 35px; color: white;
  font-family: "Roboto Slab", serif;
}
.fh5co-counter-label {
  color: rgba(255,255,255,0.8);
  font-size: 14px;
}
```

---

### Testimonios (cards)

```css
.testimonials .testi .item {
  background: #fff;
  padding: 25px;
  border-radius: 15px;
  box-shadow: 0 7px 15px rgba(0,0,0,0.1);
}
.stars i { color: #ffd832; }
```

---

### Planes / Pricing

```css
.plan {
  background: #fff;
  width: 275px;
  padding: 2rem 1rem;
  border-radius: 5px;
  transition: 0.3s;
}
.plan:hover { box-shadow: 5px 7px 67px -28px rgba(0,0,0,0.37); }

/* Plan destacado (popular) */
.plan.popular {
  border: 2px solid #2D6CDF;
}
.plan.popular span { /* badge "Más popular" */
  background-color: #2D6CDF;
  color: #fff;
  border-radius: 5px;
  padding: 6px 16px;
}

.price { font-size: 30px; color: #2D6CDF; font-weight: 600; }

.button-plans {
  background-color: #2D6CDF; color: #fff;
  border-radius: 5px; width: 50%;
  :hover { background-color: #184cad; }
}
```

---

### Formulario de contacto

```css
.registration-form form {
  background: #fff;
  max-width: 600px;
  border-radius: 30px;
  box-shadow: 0px 2px 10px rgba(0,0,0,0.075);
  padding: 20px 30px;
}
.registration-form h1 { color: #2D6CDF; font-family: "Roboto Slab", serif; }
.create-account { background-color: #2D6CDF; border-radius: 5px; color: white; }
.create-account:hover { background-color: #184cad; }
```

---

## Espaciado y layout

### Contenedores

| Clase | Comportamiento |
|---|---|
| `.container` | `width: 100%` en ≥768px |
| `.container-flex` | `padding-inline: 5rem; max-width: 100%` |
| `.container-nav` | `padding-inline: 3rem; max-width: 100%` |
| `.br-catalogo-section` | `max-width: 1280px; padding: 2rem 1.5rem 5rem` |
| `.br-filtros-inner` | `max-width: 1280px; padding: 1rem 1.5rem` |

### Secciones

Las secciones principales tienen `margin-block: 4rem`.

Alternancia de fondos:
- **Oscuro** (`#111111`): Hero, Stats/counters, Planes, Reviews
- **Claro** (`#f4f4f6` / `#fff`): Features, Calculadora, Testimonios, Contacto

### Grid del catálogo

```css
#catalogo-grid {
  display: grid;
  grid-template-columns: 1fr;         /* mobile */
  @media ≥640px: repeat(2, 1fr);     /* tablet */
  @media ≥992px: repeat(3, 1fr);     /* desktop */
  gap: 1.5rem;
}
```

---

## Border radius

| Contexto | Valor |
|---|---|
| Botones pill (CTAs, nav) | `100px` |
| Cards catálogo | `12px` (`--br-radio`) |
| Cards legacy (departamentos) | `15px` |
| Modal detalle | `16px` (desktop) / `12px 12px 0 0` (mobile) |
| Inputs, selects | `8px` |
| Pills de filtro | `20px` |
| Badges | `6px` |
| Toast | `100px` |
| Form de contacto | `30px` |

---

## Sombras

| Contexto | Valor |
|---|---|
| Card catálogo (default) | `0 2px 16px rgba(0,0,0,0.08)` |
| Card catálogo (hover) | `0 8px 32px rgba(0,0,0,0.15)` |
| Modal detalle | `0 24px 64px rgba(0,0,0,0.25)` |
| Card testimonio | `0 7px 15px rgba(0,0,0,0.1)` |
| Card departamento legacy | `0 4px 21px -12px rgba(0,0,0,0.66)` |
| Formulario | `0px 2px 10px rgba(0,0,0,0.075)` |

---

## Iconografía

### Bootstrap Icons (CDN)

Usados en el catálogo y componentes nuevos. Referencia en `departamentos.html`.

Íconos frecuentes:
- `bi-whatsapp` — contacto WhatsApp
- `bi-geo-alt-fill` — ubicación
- `bi-camera-fill` — fotos
- `bi-house-fill`, `bi-house-check-fill` — tipo de propiedad
- `bi-check-lg`, `bi-check2-square` — checkmarks
- `bi-share` — compartir
- `bi-x-lg` — cerrar modal
- `bi-sliders` — filtros

### Font Awesome 6 (CDN)

Usado en secciones legacy (planes, formulario).

- `.fa-check-circle` — ítem incluido en plan → color `#2D6CDF`
- `.fa-times-circle` — ítem no incluido → color `#eb4d4b`

### icomoon (local)

Font propio en `/fonts/icomoon/`. Usado en sección de contacto info legacy.

---

## Transiciones y animaciones

| Contexto | Transición |
|---|---|
| Hover general (links, botones) | `0.5s` / `0.2s` |
| Card hover (catálogo) | `box-shadow 0.25s, transform 0.25s` |
| Navbar scroll | `background 0.4s, backdrop-filter 0.4s, padding 0.3s` |
| Modal entrada | `transform 0.22s ease, opacity 0.22s ease` |
| Botón WhatsApp hover | `background 0.2s, transform 0.15s` |
| Filter sheet mobile | `animation: brSheetSlideUp 0.28s cubic-bezier(.4,0,.2,1)` |
| Flecha scroll | `animation: scroll-icon 2s infinite cubic-bezier(...)` |

---

## Patrones de sección

### Hero (slider)

- Fondo: imagen con `background-size: cover` + overlay `rgba(0,0,0,0.4)`
- Texto centrado, blanco
- Controles: dots en `bottom: 40px`

### Sección oscura genérica

```html
<section style="background: var(--negro); color: var(--blanco);">
```

### Sección clara genérica

```html
<section style="background: var(--gris);">
```

---

## Breakpoints responsive

| Nombre | Valor |
|---|---|
| Mobile S | ≤360px |
| Mobile | ≤480px |
| Mobile M | ≤540px |
| Mobile L | ≤575px |
| Mobile XL | ≤670px |
| Tablet | ≤768px |
| Tablet L | ≤992px |
| Desktop | ≥993px |
| Desktop L | ≥1150px |

En `≤768px`: el menú de navegación pasa a off-canvas, se activa `.fh5co-nav-toggle`.

---

## Tono de voz (resumen para copy)

- Registro: cercano y profesional — **voseo rioplatense**
- Nunca tutear
- Directo, sin vueltas, orientado a resultados concretos
- Tagline: **"Tu hogar, nuestro cuidado"**

---

## Datos de contacto (en componentes)

```
WhatsApp:   +54 9 11 7373-5757
Instagram:  @bairesrentalok
Facebook:   /profile.php?id=61566568521787
Email:      info@bairesrental.com.ar
Web:        https://www.bairesrental.com.ar
```
