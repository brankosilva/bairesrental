# BairesRental

Sitio web estático para **BairesRental**, empresa de administración de alquileres temporarios en Buenos Aires (CABA), Argentina.

## Stack

- HTML5 estático — sin build system, sin bundler, sin backend
- Bootstrap 5.3 (CDN) + Bootstrap Icons (CDN)
- Font Awesome 6 (CDN)
- jQuery + plugins locales: Flexslider, Owl Carousel, Magnific Popup, Waypoints, Stellar Parallax, countTo
- Google Fonts: Source Sans Pro, Roboto Slab
- CSS propio: `css/style.css` (principal), `css/pricing.css`

## Páginas

| Archivo | Sección |
|---|---|
| `index.html` | Home — hero slider, propuesta, planes, reviews, clientes, contacto |
| `departamentos.html` | Galería de propiedades administradas |
| `faq.html` | Preguntas frecuentes |

## Estructura de archivos

```
/
├── index.html
├── departamentos.html
├── faq.html
├── css/          # Estilos locales (vendor + style.css propio)
├── js/           # Scripts locales (vendor + main.js propio)
├── images/       # Logos, carruseles, fotos de departamentos
├── fonts/        # Icomoon icon font
└── sass/         # Fuente SASS (si se edita style.css, compilar desde acá)
```

## Convenciones

- Todo el contenido está en **español rioplatense** (vos/ustedes).
- Mantener coherencia visual con los colores y tipografías existentes en `css/style.css`.
- No introducir dependencias nuevas sin necesidad — preferir lo que ya está cargado.
- Los cambios de estilo van en `css/style.css`; no tocar los archivos vendor en `css/`.
- Para probar localmente: abrir `index.html` directamente en el navegador o levantar un servidor estático simple (`python -m http.server` o similar).

## Contacto / Redes sociales (datos reales del sitio)

- WhatsApp: +54 9 11 7373-5757
- Instagram: @bairesrentalok
- Facebook: /profile.php?id=61566568521787

---

## Marca

### Identidad

**BairesRental** es una empresa de gestión integral de alquileres temporarios en Buenos Aires (CABA), orientada a propietarios que buscan renta pasiva y a huéspedes nacionales e internacionales que buscan alojamiento de calidad.

- **Misión:** Maximizar la rentabilidad de los propietarios y ofrecer experiencias de alojamiento de alta calidad, operando de forma profesional y optimizada de extremo a extremo.
- **Visión:** Posicionarse como marca referente en alquileres temporarios en Buenos Aires, con proyección a escalar propiedades, fortalecer el canal directo y desarrollar una comunidad de viajeros.
- **Tagline:** "Tu hogar, nuestro cuidado" / "Your home, our care"

---

### Tono de voz

- **Registro:** cercano y profesional — voseo rioplatense, cálido pero serio.
- **Perfil:** como un aliado de confianza que sabe de negocios. No corporativo, no informal.
- **Reglas:** usar siempre vos/ustedes (nunca tutear). Directo, sin vueltas, sin jerga. Orientado a resultados concretos.

---

### Identidad visual

**Paleta de colores:**

| Variable | Hex | Uso |
|---|---|---|
| `--azul` | `#1A6FE8` | Color primario — CTAs, acentos, links |
| `--azul-dark` | `#1058c0` | Hover de botones |
| `--negro` | `#111111` | Fondos oscuros (hero, stats, planes, reviews) |
| `--verde` | `#25D366` | Checkmarks, WhatsApp |
| `--blanco` | `#ffffff` | Texto sobre fondos oscuros |
| `--gris` | `#f4f4f6` | Fondos de cards y secciones claras |
| `--texto-gris` | `#6b7280` | Texto secundario |

**Tipografía:** DM Sans (Google Fonts), pesos 300–800. Es la fuente principal para todo contenido nuevo.

**Logos disponibles en `/images/`:**
- `bairesrentallogoblanco.png` — navbar y footer (sobre fondos oscuros)
- `bairesrental-high-resolution-logo.png` — color, alta resolución
- `bairesrental-high-resolution-logo-black.png` — negro, alta resolución
- `bairesrentallogoredes.png` — redes sociales

**Estética general:** secciones oscuras (hero, stats, planes, reviews) alternadas con secciones claras (features, calculadora, testimonios). Cards con `border-radius: 16px`, botones pill con `border-radius: 100px`.

---

### Propuesta de valor

**Para propietarios:**
- Gestión 100% integral (fotos, publicación, reservas, limpieza, check-in/out)
- Revenue management con precios dinámicos
- Ingresos en USD sin complicaciones
- Reportes de rendimiento
- Atención al huésped 24/7

**Para huéspedes:**
- Departamentos verificados y equipados
- Atención personalizada antes, durante y después de la estadía
- Ubicaciones estratégicas (Palermo, Recoleta, Belgrano y zonas turísticas)
- Experiencia simple y confiable

---

### Planes y servicios

| Plan | Comisión | Descripción |
|---|---|---|
| **Gestión Online** | 12% del neto | Fotos, perfil, gestión de reservas, precios dinámicos, soporte 24/7 |
| **Gestión Mensual** | 15% del contrato | Todo lo anterior + selección de inquilinos, check-in/out, cobranzas, limpieza |
| **Gestión Airbnb** | 25% del neto | Fotos, Airbnb + Booking, limpieza profesional, reposición de ropa blanca, lavandería, soporte 24/7 |

Fee inicial único de setup (fotografía, optimización de perfil, alta en plataformas). Comisión se aplica sobre ingresos netos (deducida limpieza, lavandería ~USD 30, fees de plataformas).

---

### Público objetivo

**Propietarios:**
- Dueños que buscan renta pasiva sin ocupar tiempo
- Inversores inmobiliarios con departamentos en CABA
- Personas que se van al exterior o no tienen tiempo para gestionar

**Huéspedes:**
- Turistas internacionales
- Nómadas digitales (nicho clave y diferenciador)
- Viajeros de media y larga estadía

---

### Canales de comercialización

- **Airbnb** y **Booking.com** — plataformas principales de generación de reservas
- **Canal directo** — web bairesrental.com.ar (objetivo de crecimiento)
- **WhatsApp** — ventas directas y coordinación operativa
- **Comunidad de nómadas digitales** — nicho diferenciador

---

### Canales de comunicación

| Canal | Uso |
|---|---|
| WhatsApp +54 9 11 7373-5757 | Principal operativo: huéspedes, reservas directas, check-in/out, incidencias |
| bairesrental.com.ar | Catálogo, institucional, captación de propietarios |
| Instagram @bairesrentalok | Contenido visual, testimonios, branding, generación de confianza |
| Airbnb / Booking | Generación de reservas + validación social mediante reviews |

---

### Flujo operativo

1. **Captación** — contacto con propietario, evaluación del inmueble, definición de estrategia de precios
2. **Preparación** — equipamiento completo, fotos profesionales, alta en plataformas
3. **Publicación** — creación de anuncios, SEO interno en plataformas, ajuste dinámico de precios
4. **Gestión de reservas** — recepción de consultas, conversión de leads, coordinación de fechas
5. **Check-in / Check-out** — coordinación con el huésped, entrega de llaves o acceso digital
6. **Limpieza y mantenimiento** — limpieza profesional entre estadías, control de calidad, resolución de incidencias
7. **Post-estadía** — solicitud de reviews, análisis de feedback, reporte al propietario

---

### Diferenciales competitivos

- Atención personalizada (no automatizada)
- Foco específico en nómadas digitales
- Gestión end-to-end (el propietario no hace nada)
- Presencia multi-canal (Airbnb + Booking + directo + WhatsApp)
- Optimización constante de ingresos (revenue management activo)

---

### Métricas y reconocimientos

- **300+** huéspedes recibidos
- **2.500+** noches reservadas
- **150+** reseñas
- **9.6/10** calificación promedio
- **85%** tasa de ocupación
- Booking.com **Traveller Review Award 2025**
- Airbnb **Superhost 2026**

---

### Visión y expansión

- Escalar la cantidad de propiedades administradas en CABA
- Fortalecer el canal de ventas directas (reducir dependencia de plataformas)
- Desarrollar comunidad de viajeros y nómadas digitales
- Incorporar tecnología para automatización operativa

---

## Carga de propiedades al catálogo

Las propiedades se almacenan en `data/departamentos.json` (array JSON). Por su tamaño, **nunca leer ni editar ese archivo directamente** — siempre usar los scripts de `scripts/`.

### Scripts disponibles

| Script | Uso |
|---|---|
| `scripts/add-from-tokko.js` | Convierte un JSON de Tokko Broker al formato BairesRental y lo agrega al catálogo |
| `scripts/add-property.js` | Valida y agrega un objeto ya en formato BairesRental al catálogo |

Ambos requieren Node.js (`node --version` para verificar).

---

### Flujo 1: Import desde Tokko Broker

El usuario pega un JSON de Tokko (obtenido desde el administrador Tokko) en el chat.

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
| `fichaUrl` | `web_property_url` |
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
  "fotos": "https://photos.app.goo.gl/... ← álbum Google Photos (opcional)",
  "fichaUrl": "https://... ← link Airbnb/Booking/agencia (opcional, tiene prioridad sobre fotos)",
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
