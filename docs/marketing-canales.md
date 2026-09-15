# Marketing y canales

## Contacto / redes sociales (datos reales)

- WhatsApp: +54 9 11 7373-5757 (`wa.me/5491173735757`)
- Email: bairesrentalok@gmail.com
- Instagram: [@bairesrentalok](https://instagram.com/bairesrentalok)
- Facebook: `/profile.php?id=61566568521787`
- Sitio: www.bairesrental.com.ar

## Canales de comunicación

| Canal | Uso |
|---|---|
| WhatsApp | Principal operativo: huéspedes, reservas directas, check-in/out, incidencias |
| bairesrental.com.ar | Catálogo, institucional, captación de propietarios |
| Instagram @bairesrentalok | Contenido visual, testimonios, branding, generación de confianza |
| Airbnb / Booking | Generación de reservas + validación social mediante reviews |
| Comunidad WhatsApp | Grupo para nómadas digitales / huéspedes recurrentes, linkeado desde el footer y desde `departamentos.html` |

## Tracking instalado

- **Meta Pixel** `1704524150703684` en `index.html` y `departamentos.html` — actualmente **solo dispara `PageView`**, sin evento de conversión (`Contact`/`Lead`) en el clic de WhatsApp. Esto es una limitación conocida, no un objetivo de diseño.
- **GA4**: `G-3Q9QZ52W03`.

## Estrategia de Meta Ads

Documento completo en [`marketing/estrategia-meta-ads.md`](../marketing/estrategia-meta-ads.md) (última revisión: 2026-08-13). Resumen:

- **Presupuesto actual:** ~USD 200/mes.
- **Diagnóstico central:** al no trackear el clic a WhatsApp como conversión, Meta optimiza por clics baratos en vez de consultas reales. Los reels de estilo de vida en Buenos Aires generan buen engagement pero enlazan al perfil de Instagram en vez del catálogo/WhatsApp, perdiendo intención en el último paso. Los carruseles de un solo departamento rinden peor que mostrar el catálogo en general.
- **Recomendaciones priorizadas:**
  1. Instrumentar el evento de conversión (`fbq('track','Contact')` en el clic a WhatsApp) o migrar a **Click-to-WhatsApp Ads** (objetivo "Mensajes" nativo de Meta), dado el bajo volumen (~50 eventos/semana para salir de la fase de aprendizaje).
  2. Los reels de estilo de vida deben linkear al catálogo o a WhatsApp directamente, no al perfil de Instagram.
  3. Separar en dos tipos de campaña: **Awareness** (contenido lifestyle, bajo presupuesto, objetivo engagement/alcance, destino catálogo) vs. **Retargeting/Conversión** (carrusel de catálogo u objetivo Mensajes, targeteando gente que interactuó con reels/catálogo/redes en los últimos 14–30 días). Split sugerido: ~60% awareness / 40% retargeting con el presupuesto de $200/mes.
  4. Creatividades de catálogo tipo "3 departamentos disponibles esta semana en Palermo/Recoleta" en vez de anuncios de una sola propiedad; linkear con filtro pre-aplicado si la plataforma lo permite (ej. `departamentos.html?barrio=palermo`).
  5. **Segmentación:** audiencia/campaña diferenciada para **nómadas digitales** (intereses remote work/digital nomad, geo EEUU/Europa, creatividad en inglés) separada de la de **captación de propietarios locales** (geo Argentina/CABA, mensaje "dejá de ocuparte del alquiler, ganá en USD").
  6. **Medición:** trackear costo por conversación de WhatsApp iniciada (no CPC/CPM crudo) semanalmente, más CTR por creatividad.
- **Próximos pasos pendientes** (checklist del doc, sin resolver a la fecha): confirmar objetivo de campaña actual, decidir migración a Click-to-WhatsApp, agregar tracking del evento `Contact` en los links de WhatsApp, armar 2-3 creatividades "múltiples departamentos" para testear, construir audiencia de retargeting (visitas al sitio + engagement de 30 días en IG/FB).

Antes de tocar campañas o el pixel, releer el documento completo — puede haber cambiado desde la última revisión.
