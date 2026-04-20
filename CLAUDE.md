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
