// Quién está del otro lado de un link compartido — del lado del navegador.
//
// ¿POR QUÉ ACÁ Y NO UNA COOKIE EN EL SERVIDOR?
//
// Todo el sitio pasa por la Cloud Function `nuxtSsr` detrás de Firebase
// Hosting, y Hosting BORRA todas las cookies entrantes salvo `__session`
// —que acá ya la usa la sesión de Firebase Auth—. O sea: una cookie propia
// se setearía bien y no volvería nunca. El id tiene que vivir en el
// navegador y viajar explícito en el ping.
//
// Lo que esto arregla: hasta ahora el servidor sumaba una apertura por
// CADA request a /l/*, así que recargar, volver atrás o mirar tres fichas
// del catálogo eran cuatro "aperturas" de la misma persona.
//
// Si el navegador no deja guardar nada (incógnito estricto, storage
// bloqueado), no se manda nada: preferimos un número corto a uno inflado
// que vuelve a contar a la misma persona en cada vista.

const ID_KEY = 'br_vid'
const SEEN_KEY = 'br_lseen'

// Una visita nueva de la misma persona al mismo link. Media hora es lo que
// dura mirar un catálogo con idas y vueltas; más allá de eso, que vuelva a
// abrirlo es información real para el vendedor ("lo está pensando").
const SESSION_MS = 30 * 60 * 1000

interface Visitor {
  id: string
  isNew: boolean
}

function newId(): string {
  // randomUUID pide contexto seguro; en https siempre está, pero un
  // preview por http no puede quedarse sin id.
  try {
    if (crypto?.randomUUID) return crypto.randomUUID()
  } catch { /* abajo */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** El id de este navegador. `null` si no hay dónde guardarlo. */
function visitor(): Visitor | null {
  try {
    const stored = localStorage.getItem(ID_KEY)
    if (stored) return { id: stored, isNew: false }
    const id = newId()
    localStorage.setItem(ID_KEY, id)
    // Confirmar que quedó: Safari en modo privado acepta el setItem y
    // devuelve null después, y ahí cada vista sería una persona nueva.
    return localStorage.getItem(ID_KEY) === id ? { id, isNew: true } : null
  } catch {
    return null
  }
}

export function linkVisitorId(): string | null {
  return visitor()?.id ?? null
}

/**
 * Marca una vista y dice qué hacer con ella.
 *
 * Dos claves distintas a propósito:
 *
 * · Por LINK: decide si esto cuenta como una apertura. Una sola por
 *   sesión, por más páginas que mire adentro.
 * · Por VISTA (link + publicación): decide si vale la pena mandar el ping.
 *   La apertura ya está contada, pero el vendedor sí quiere ver QUÉ fichas
 *   miró el cliente, y eso vive en el detalle de actividad. La misma ficha
 *   dos veces en la misma sesión no aporta nada y no se manda.
 */
function markView(code: string, propertyId?: string | null): { send: boolean; count: boolean } {
  const now = Date.now()
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, number>
    const viewKey = propertyId ? `${code}/${propertyId}` : code
    const count = now - (seen[code] ?? 0) >= SESSION_MS
    const send = count || now - (seen[viewKey] ?? 0) >= SESSION_MS
    if (!send) return { send: false, count: false }

    seen[code] = now
    seen[viewKey] = now
    // Sin poda esto crece con cada link que la persona abra en su vida.
    for (const [k, v] of Object.entries(seen)) {
      if (now - v > 90 * 24 * 60 * 60 * 1000) delete seen[k]
    }
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
    return { send: true, count }
  } catch {
    return { send: false, count: false }
  }
}

/**
 * Avisa que alguien está mirando el link. Nunca bloquea ni rompe la página.
 *
 * Manda dos cosas distintas: una apertura (`c=1`, una por sesión) o sólo
 * el rastro de qué publicación se está mirando dentro de una sesión que ya
 * se contó.
 *
 * Los scrapers de preview (WhatsApp, Facebook, Instagram) no ejecutan JS,
 * así que no llegan nunca acá: el filtro de User-Agent del servidor sigue
 * existiendo, pero ya no es lo único que separa una persona de una tarjeta
 * de preview.
 */
export function pingLinkOpen(code: string, propertyId?: string | null): void {
  if (!import.meta.client) return
  const who = visitor()
  if (!who) return
  const { send, count } = markView(code, propertyId)
  if (!send) return

  const params = new URLSearchParams({ v: who.id })
  if (count) params.set('c', '1')
  if (who.isNew) params.set('n', '1')
  if (propertyId) params.set('p', propertyId)
  const url = `/api/l/${code}/open?${params}`
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(url)
    else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    /* medir no puede romper la página */
  }
}
