import { computed } from 'vue'
import type { LinkChannel, LinkDevice, LinkOpenEvent, LinkOutcome, TrackableLink } from '~/types/link'

// Lógica compartida entre /app/seller/links y /app/admin/links: las dos
// pantallas muestran los mismos números, una filtrada por vendedor y la
// otra no. Vive acá para que no se calculen de dos maneras distintas y
// terminen discrepando.

export type LinkRow = TrackableLink & { id: string }

const CHANNEL_LABELS: Record<LinkChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'Email',
  sms: 'SMS',
  facebook: 'Facebook',
  presencial: 'En persona',
  otro: 'Otro',
}

const OUTCOME_LABELS: Record<LinkOutcome, string> = {
  pending: 'Pendiente',
  replied: 'Contestó',
  visited: 'Visitó',
  closed: 'Cerró',
  lost: 'Perdido',
}

// Mismos colores que los estados de disponibilidad del panel (ver
// utils/availability.ts), para que el panel se lea como una sola cosa.
const OUTCOME_CLASSES: Record<LinkOutcome, string> = {
  pending: 'is-pending',
  replied: 'is-replied',
  visited: 'is-visited',
  closed: 'is-closed',
  lost: 'is-lost',
}

const DEVICE_LABELS: Record<LinkDevice, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  android: 'Android',
  desktop: 'Computadora',
  other: 'Otro',
}

export function channelLabel(c?: LinkChannel | null): string {
  return c ? CHANNEL_LABELS[c] ?? c : '—'
}

// Cómo se llama un link. `label` es el campo de hoy —el nombre que le puso
// el vendedor— y `recipientName` el de antes, cuando un link era de un
// cliente concreto. Los links viejos siguen en Firestore con el segundo y no
// hubo backfill, así que TODO lo que muestre el nombre de un link pasa por
// acá y no lee los campos directo.
export function linkLabel(l: Pick<TrackableLink, 'label' | 'recipientName'>): string {
  return (l.label || l.recipientName || '').trim() || 'Sin nombre'
}

export function outcomeLabel(o?: LinkOutcome | null): string {
  return o ? OUTCOME_LABELS[o] ?? o : OUTCOME_LABELS.pending
}

export function outcomeClass(o?: LinkOutcome | null): string {
  return OUTCOME_CLASSES[o ?? 'pending'] ?? 'is-pending'
}

export function deviceLabel(d?: LinkDevice | null): string {
  return d ? DEVICE_LABELS[d] ?? d : 'Otro'
}

// Los contadores pueden faltar en links creados antes de esta milestone
// (FieldValue.increment() crea el campo recién en su primer incremento, no
// hubo backfill). Todo lo que los lea tiene que pasar por acá.
export function n(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

// Firestore devuelve Timestamp del lado cliente, pero un doc recién escrito
// puede traer todavía el sentinel de serverTimestamp() (null). Y las notas
// de leads guardan ISO strings. Acepta las tres formas.
export function toMillis(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null) {
    const ts = value as { seconds?: number; toMillis?: () => number }
    if (typeof ts.toMillis === 'function') return ts.toMillis()
    if (typeof ts.seconds === 'number') return ts.seconds * 1000
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function relativeTime(value: unknown): string {
  const ms = toMillis(value)
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60_000) return 'recién'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  return new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function eventDateTime(value: unknown): string {
  const ms = toMillis(value)
  if (!ms) return '—'
  return new Date(ms).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface LinkTotals {
  links: number
  opens: number
  visitors: number
  whatsappClicks: number
  leads: number
  closed: number
  // Aperturas reales sobre clics de contacto. Es una señal de INTENCIÓN, no
  // un cierre: la etiqueta en pantalla dice "tasa de contacto" justamente
  // para no venderla como una conversión que nadie midió.
  contactRate: number
  lastActivity: number | null
}

export function totalsFor(rows: LinkRow[]): LinkTotals {
  const totals = rows.reduce(
    (acc, l) => {
      acc.links += 1
      acc.opens += n(l.opens)
      acc.visitors += n(l.visitors)
      acc.whatsappClicks += n(l.whatsappClicks)
      // `clicks` es el nombre viejo de `leads`; los links anteriores a esta
      // milestone sólo tienen ese campo. Se toma el mayor de los dos en vez
      // de sumarlos, porque submitLead escribe LOS DOS en los links nuevos y
      // sumarlos contaría cada lead dos veces.
      acc.leads += Math.max(n(l.leads), n(l.clicks))
      if (l.outcome === 'closed') acc.closed += 1
      const last = toMillis(l.lastOpenAt)
      if (last && (!acc.lastActivity || last > acc.lastActivity)) acc.lastActivity = last
      return acc
    },
    { links: 0, opens: 0, visitors: 0, whatsappClicks: 0, leads: 0, closed: 0, contactRate: 0, lastActivity: null as number | null },
  )
  totals.contactRate = totals.opens > 0 ? totals.whatsappClicks / totals.opens : 0
  return totals
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// Los eventos de bots se guardan igual que los de personas (con
// `isBot: true`) para que el filtro se pueda auditar, pero no van mezclados
// en la lista que ve el vendedor: se cuentan aparte y se muestran plegados.
export function splitEvents(events: LinkOpenEvent[]) {
  const human = events.filter((e) => !e.isBot)
  const bots = events.filter((e) => e.isBot)
  return { human, bots }
}

// Cuántas personas distintas hay en ESTA lista de eventos. Desde que el
// navegador manda su id, el hash es estable en el tiempo (ver
// server/utils/botDetect.ts): la misma persona en dos días es una sola. En
// los eventos viejos el hash salía de IP+UA+día, así que ahí sigue
// contando doble. El total de siempre del link es `visitors`.
export function distinctVisitors(events: LinkOpenEvent[]): number {
  return new Set(events.filter((e) => !e.isBot).map((e) => e.visitorHash)).size
}

/** Arma la URL pública de un link a partir del origen configurado del sitio. */
export function useLinkUrl() {
  // Reutiliza `site.url` de nuxt.config.ts en vez de una constante propia: es
  // el mismo origen con el que se arman canonical y og:url, y un solo lugar
  // donde cambiarlo. Hoy vale https://www.bairesrental.com.ar. OJO: se
  // resuelve en el BUILD (NUXT_PUBLIC_SITE_URL es de build time), así que
  // cambiarlo pide redeploy, no basta con tocar una variable del runtime.
  //
  // Antes de esto, la URL estaba hardcodeada a www.bairesrental.com.ar en
  // esta pantalla Y dentro de createTrackableLink — un dominio sin ruta /l/,
  // o sea que todos los links generados hasta ahora estaban rotos.
  const siteConfig = useSiteConfig()

  // OJO con el fallback: del lado cliente useSiteConfig() devuelve un objeto
  // reactivo VACÍO que se completa en un watchEffect (ver
  // node_modules/nuxt-site-config/.../useSiteConfig.js). Si alguien lo lee
  // antes de que corra, `url` es undefined y el link quedaría como
  // "/l/abc123" — una ruta relativa que se copia y se manda rota, sin
  // ningún error visible. window.location.origin es el mismo host desde el
  // que se está usando el panel, así que es un default correcto, no un
  // parche.
  const origin = computed(() => {
    const configured = (siteConfig.url || '').replace(/\/$/, '')
    if (configured) return configured
    return import.meta.client ? window.location.origin : ''
  })

  return {
    origin,
    linkUrl: (code: string) => `${origin.value}/l/${code}`,
  }
}
