// Ported verbatim from app/src/utils/format.ts. Lives under app/utils/ so
// Nuxt auto-imports it (no relative import needed in pages/components).

export function formatPrice(precio: number, moneda: string): string {
  if (!precio) return 'Consultar precio'
  return `${moneda} ${precio.toLocaleString('es-AR')}`
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/5491173735757?text=${encodeURIComponent(message)}`
}

export function truncate(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// Ported from departamento.html/detalle-venta.html's getMapQuery(): the
// embeddable Google Maps iframe needs a plain text query, not a maps.app
// share link, so this prefers the `q`/`query` param off direccionUrl (when
// it's already a Google Maps URL) and falls back to the raw address.
export function mapEmbedQuery(direccion?: string, direccionUrl?: string): string {
  if (direccionUrl) {
    try {
      const u = new URL(direccionUrl)
      const q = u.searchParams.get('q') || u.searchParams.get('query')
      if (q) return q
    } catch {
      // not a parseable URL — fall through to the address-based query
    }
  }
  return direccion ? `${direccion}, Ciudad Autónoma de Buenos Aires, Argentina` : ''
}

export function mapEmbedSrc(direccion?: string, direccionUrl?: string): string {
  const q = mapEmbedQuery(direccion, direccionUrl)
  return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : ''
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Ported from departamento.html's formatFecha(), extended to English.
// `fecha` is a plain YYYY-MM-DD string — parsed as UTC to avoid the
// timezone off-by-one Date(string) parsing would otherwise introduce.
export function formatLongDate(fecha: string, locale: string): string {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  if (locale === 'en') {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  return `${d} de ${MESES_ES[m - 1]} de ${y}`
}
