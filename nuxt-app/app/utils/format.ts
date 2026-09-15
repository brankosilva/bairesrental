// Ported verbatim from app/src/utils/format.ts. Lives under app/utils/ so
// Nuxt auto-imports it (no relative import needed in pages/components).

export function formatPrice(precio: number, moneda: string): string {
  if (!precio) return 'Consultar precio'
  return `${moneda} ${precio.toLocaleString('es-AR')}`
}

// El número de BairesRental. Sigue siendo el default de todo el sitio
// público; el segundo parámetro de whatsappUrl() sólo lo pisa en las
// páginas con la marca del vendedor.
export const BR_WHATSAPP = '5491173735757'

// Normaliza lo que un vendedor tipeó en su ficha a lo que espera wa.me:
// sólo dígitos, sin '+', con código de país.
//
// A propósito conservadora — un número de contacto mal "corregido" es un
// cliente que nunca llega. Sólo hace el arreglo que en Argentina es
// inequívoco (el 9 de celular después del 54) y, ante cualquier otra cosa,
// devuelve los dígitos tal cual se cargaron. La pantalla de la ficha
// muestra un preview del wa.me resultante para que el vendedor lo
// verifique él mismo en vez de confiar en esta función.
export function normalizeWhatsapp(raw?: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  // 54 + 11 + 8 dígitos = 13 con el 9; sin el 9 son 12 y wa.me no resuelve.
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    return `549${digits.slice(2)}`
  }
  return digits
}

// `phone` es opcional para que los cuatro call sites que ya existían
// (las dos fichas públicas, SiteFabs y el layout) sigan andando sin
// tocarlos: sin segundo argumento, esto es exactamente lo que era.
export function whatsappUrl(message: string, phone?: string | null): string {
  const number = normalizeWhatsapp(phone) || BR_WHATSAPP
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// Handle de Instagram listo para armar instagram.com/<handle>, o null.
//
// Valida en serio en vez de sólo sacar la arroba: el campo `instagram` de
// sellerProfiles es texto libre y HOY, en producción, hay una ficha que tiene
// ahí cargado un mail. Sin este filtro eso sale publicado como
// instagram.com/alguien@gmail.com — un link roto y, peor, el mail de una
// persona expuesto en una página que ve el cliente.
//
// Reglas reales de Instagram: 1-30 caracteres, letras, números, punto y guión
// bajo. Se acepta que venga pegada la URL entera, que es lo que copia
// cualquiera desde el navegador.
export function instagramHandle(raw?: string | null): string | null {
  if (!raw) return null
  const handle = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null
}

// El número que se MUESTRA (la tarjeta del vendedor en /l/:code), distinto
// del que se usa para armar el wa.me. Sólo formatea el caso inequívoco —
// 549 + 11 + 8 dígitos, o sea CABA/GBA, que es todo lo que hay hoy—; para
// cualquier otro largo de característica devuelve los dígitos con un '+'
// adelante en vez de partirlos donde no corresponde. Misma política
// conservadora que normalizeWhatsapp(): un número mal presentado es un
// cliente que marca mal.
export function formatWhatsappDisplay(raw?: string | null): string | null {
  const digits = normalizeWhatsapp(raw)
  if (!digits) return null
  const ar = /^549(11)(\d{4})(\d{4})$/.exec(digits)
  if (ar) return `+54 9 ${ar[1]} ${ar[2]}-${ar[3]}`
  return `+${digits}`
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
