# Marca

Referencia completa (con snippets de CSS por componente) en [`marketing/brand-guide.md`](../marketing/brand-guide.md). Este documento resume lo esencial.

## Tono de voz

- **Registro:** cercano y profesional — voseo rioplatense, cálido pero serio.
- **Perfil:** aliado de confianza que sabe de negocios. No corporativo, no informal.
- **Reglas:** siempre vos/ustedes (nunca tutear). Directo, sin vueltas, sin jerga. Orientado a resultados concretos.

## Paleta de colores

| Variable | Hex | Uso |
|---|---|---|
| `--azul` | `#1A6FE8` | Color primario — CTAs, acentos, links |
| `--azul-dark` | `#1058c0` | Hover de botones |
| `--negro` | `#111111` | Fondos oscuros (hero, stats, planes, reviews) |
| `--verde` | `#25D366` | Checkmarks, WhatsApp |
| `--blanco` | `#ffffff` | Texto sobre fondos oscuros |
| `--gris` | `#f4f4f6` | Fondos de cards y secciones claras |
| `--gris2` | `#e8e8ec` | Bordes / fondos secundarios claros |
| `--texto-gris` | `#6b7280` | Texto secundario |

Existe una paleta paralela `--br-*` específica del catálogo (mismos azul/verde, grises y sombras levemente distintos) — usarla dentro de los componentes de catálogo (`departamentos.html`, `ventas.html`, cards, modal de detalle) en vez de mezclarla con las variables globales.

**Colores de estado** (disponibilidad en catálogo): Disponible `#16a34a` (verde), Reservado `#d97706` (naranja), No disponible / Vendido `#dc2626` (rojo), BairesRental (propio) `#1A6FE8` (azul).

**Colores legacy — no usar en componentes nuevos:** `#2D6CDF`, `#184cad`, `#ffd832`, `#003580` (azul de Booking).

## Tipografía

- **DM Sans** (Google Fonts, pesos 300–800) — fuente principal para todo contenido nuevo.
- Secciones legacy usan Source Sans Pro (cuerpo) y Roboto Slab (títulos/footer) — no migrar salvo que se pida explícitamente.
- Icomoon (fuente de íconos local, `fonts/`) se usa en secciones de contacto legacy.

## Logos (`/images/`)

- `bairesrentallogoblanco.png` — navbar y footer (sobre fondos oscuros)
- `bairesrental-high-resolution-logo.png` — color, alta resolución
- `bairesrental-high-resolution-logo-black.png` — negro, alta resolución
- `bairesrentallogoredes.png` — redes sociales
- `logo-perfin-redes.png` — variante de perfil para redes (ver brand-guide)

## Assets de premios/plataformas

Badge del Traveller Review Award 2025 (Booking), tarjeta/logo Superhost 2026 (Airbnb), y logos de Airbnb/Booking/WhatsApp — ver `marketing/brand-guide.md` para los paths exactos.

## Estética general

Secciones oscuras (hero, stats, planes, reviews) alternadas con secciones claras (features, calculadora, testimonios). Cards con `border-radius: 16px`, botones pill con `border-radius: 100px`. Grid del catálogo: 1 columna en mobile, 2 columnas ≥640px, 3 columnas ≥992px. Cards de propiedad (`.br-prop-card`): imagen de 210px de alto, radio de 12px.
