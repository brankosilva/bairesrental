// Resolución de links compartibles y registro de su actividad.
//
// Todo lo que toca `links` desde el servidor pasa por acá, con el Admin
// SDK: desde esta milestone la colección dejó de ser públicamente legible
// (los documentos llevan el nombre de la persona a la que el vendedor le
// compartió el link, que es dato de un tercero), así que ya no alcanza con
// el SDK cliente y las reglas públicas que usaba antes esta ruta.
import { FieldValue } from 'firebase-admin/firestore'
import type { H3Event } from 'h3'
import type { LinkEventType, TrackableLink } from '~/types/link'
import { isShareableBySeller } from '~/utils/sellerScope'
import { classifyRequest } from './botDetect'

export interface ResolvedLink extends TrackableLink {
  code: string
}

/**
 * ¿Este vendedor puede mostrar esta publicación bajo su marca?
 *
 * Hace falta ANTES de contar la apertura de /l/:code/:propertyId. Sin
 * esto, pedir /l/<code>/<id-cualquiera> sumaba una apertura y dejaba un
 * evento con el id de una publicación ajena — aunque la página devolviera
 * 404. O sea: cualquiera podía inflarle los números a un vendedor, y el
 * detalle de actividad mostraba propiedades que no son suyas.
 *
 * Antes exigía que la publicación FUERA del vendedor. Ahora el criterio es
 * `isShareableBySeller()` —el catálogo de BairesRental más lo propio, nunca
 * la exclusiva de otro vendedor—, el mismo que aplican el panel y el
 * callable que genera los links. Ver app/utils/sellerScope.ts.
 */
export async function propertyShareableBySeller(propertyId: string, sellerUid: string): Promise<boolean> {
  const db = getAdminFirestore()
  for (const col of ['rentals', 'sales']) {
    const snap = await db.collection(col).doc(propertyId).get()
    if (snap.exists) return isShareableBySeller(snap.data() ?? {}, sellerUid)
  }
  return false
}

export async function resolveLink(code: string): Promise<ResolvedLink | null> {
  const snap = await getAdminFirestore().collection('links').doc(code).get()
  if (!snap.exists) return null
  return { code: snap.id, ...(snap.data() as TrackableLink) }
}

// Presupuesto para la escritura de tracking. La actividad es un efecto
// secundario: nunca debe hacer esperar a quien está abriendo la página.
//
// No se puede disparar sin esperar ("fire and forget"): en Cloud Functions
// gen2 el trabajo que queda pendiente después de responder se corta, así
// que la escritura se perdería a veces sí y a veces no. Por eso se espera,
// pero contra un reloj.
const TRACKING_TIMEOUT_MS = 800

function withTimeout(work: Promise<unknown>): Promise<void> {
  return Promise.race([
    work.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, TRACKING_TIMEOUT_MS)),
  ]).catch((err) => {
    // Que falle Firestore no puede romper la página del cliente.
    console.error('[linkTracking] no se pudo registrar la actividad:', err)
  })
}

interface RecordOptions {
  type?: LinkEventType
  propertyId?: string | null
}

/**
 * Registra un evento sobre un link y actualiza sus contadores.
 *
 * Devuelve la clasificación para que quien llama pueda decidir (por
 * ejemplo, no registrar nada en un HEAD). Los bots NO se descartan: se
 * guardan con `isBot: true` y suman a `botOpens` en vez de a `opens`, así
 * el filtro queda auditable.
 */
export async function recordLinkEvent(
  event: H3Event,
  link: ResolvedLink,
  options: RecordOptions = {},
): Promise<void> {
  const { type = 'open', propertyId = null } = options
  const classification = classifyRequest(event, link.code)

  if (classification.skip) return

  const db = getAdminFirestore()
  const linkRef = db.collection('links').doc(link.code)

  // Un solo batch: el contador y el evento entran o no entran juntos, para
  // que el detalle de actividad nunca contradiga al número de arriba.
  const batch = db.batch()

  const counters: Record<string, unknown> = {}
  if (type === 'whatsapp') {
    counters.whatsappClicks = FieldValue.increment(1)
  } else if (classification.isBot) {
    counters.botOpens = FieldValue.increment(1)
  } else {
    counters.opens = FieldValue.increment(1)
    counters.lastOpenAt = FieldValue.serverTimestamp()
    // Sólo la primera vez. `create: false` en el merge no existe, así que
    // se resuelve con un campo que sólo se escribe si todavía no está.
    if (!link.firstOpenAt) counters.firstOpenAt = FieldValue.serverTimestamp()
  }
  batch.set(linkRef, counters, { merge: true })

  batch.set(linkRef.collection('opens').doc(), {
    sellerUid: link.sellerUid,
    type,
    at: FieldValue.serverTimestamp(),
    propertyId: propertyId ?? link.propertyId ?? null,
    visitorHash: classification.visitorHash,
    device: classification.device,
    referer: classification.referer,
    lang: classification.lang,
    isBot: classification.isBot,
    botName: classification.botName,
  })

  await withTimeout(batch.commit())
}
