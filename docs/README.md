# Documentación de BairesRental

Índice de la documentación del proyecto. `CLAUDE.md` (raíz del repo) es el punto de entrada operativo para trabajar con Claude Code; estos documentos son la referencia detallada.

| Documento | Contenido |
|---|---|
| [negocio.md](negocio.md) | Misión, visión, propuesta de valor, planes/comisiones, público objetivo, métricas y flujo operativo |
| [marca.md](marca.md) | Identidad visual, tono de voz, paleta de colores, tipografía, logos |
| [sitio-paginas.md](sitio-paginas.md) | Inventario completo de páginas del sitio (públicas, internas para vendedores, admin) |
| [catalogo-datos.md](catalogo-datos.md) | Esquema de `data/departamentos.json` y `data/ventas.json`, scripts de carga, panel admin |
| [marketing-canales.md](marketing-canales.md) | Canales de contacto/redes, tracking, estrategia de Meta Ads |
| [requisitos-alquiler.pdf](requisitos-alquiler.pdf) | PDF con los requisitos para alquilar, linkeado desde `departamentos.html` |
| [historial-app-vue.md](historial-app-vue.md) | Log histórico de la primera migración a Vue + Firebase (la app `app/`, ya eliminada) — qué se hizo, qué se rompió y cómo se resolvió, milestone por milestone |
| [../nuxt-app/README.md](../nuxt-app/README.md) | Setup y comandos de la app Nuxt (`nuxt-app/`, la que está viva en `bairesrental.web.app`) — Firebase, functions, rules, build y deploy |
| [../nuxt-app/CHANGELOG.md](../nuxt-app/CHANGELOG.md) | Log de la migración a Nuxt 4 con SSR real, milestone por milestone |

Todo el contenido de estos documentos fue extraído directamente del sitio (HTML real, `data/*.json`, `scripts/*.js`, `marketing/*.md`) el 2026-09-12, no de notas previas — si el sitio cambia, estos documentos pueden quedar desactualizados y conviene releerlo desde el HTML.
