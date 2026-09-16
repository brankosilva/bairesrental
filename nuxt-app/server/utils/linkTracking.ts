// Resolución de links compartibles y registro de su actividad.
//
// Todo lo que toca `links` desde el servidor pasa por acá, con el Admin
// SDK: la colección no es públicamente legible (los documentos llevan las
// notas que el vendedor escribió sobre sus clientes, que son datos de un
// tercero), así que no alcanza con el SDK cliente y las reglas públicas que
// usaba antes esta ruta.
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
 * El criterio es `isShareableBySeller()`, el mismo que aplican el panel, el
 * callable que genera los links y la página compartida — hoy devuelve true
 * para todo el catálogo. Ver app/utils/sellerScope.ts: la llamada se
 * mantiene para que el día que el recorte vuelva, vuelva en los cuatro
 * lugares a la vez. Lo que sigue haciendo esta función es confirmar que la
 * publicación EXISTE, o sea que /l/<code>/<id-inventado> no suma aperturas.
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
  // El id que el navegador guarda en localStorage (app/utils/linkVisitor.ts).
  visitorId?: string | null
  // `true` sólo la primera vez que ese navegador abre un link: es lo que
  // hace avanzar el contador de PERSONAS. Lo dice el cliente, que es el
  // único que sabe si la clave ya estaba guardada.
  visitorIsNew?: boolean
  // `false` cuando la persona ya venía mirando este link: el evento se
  // guarda igual —para que el vendedor vea qué fichas miró— pero no suma
  // otra apertura.
  countOpen?: boolean
  // Los pings (sendBeacon/fetch) no piden un documento HTML; la navegación
  // sí. Ver ClassifyOptions en botDetect.ts.
  expectDocument?: boolean
}

/**
 * Registra un evento sobre un link y actualiza sus contadores.
 *
 * Las aperturas de personas llegan por el ping del navegador
 * (server/api/l/[code]/open.post.ts), que ya viene deduplicado por sesión;
 * el middleware sólo trae por acá lo que clasifica como bot.
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
  const {
    type = 'open',
    propertyId = null,
    visitorId = null,
    visitorIsNew = false,
    countOpen = true,
    expectDocument = true,
  } = options
  const classification = classifyRequest(event, link.code, { visitorId, expectDocument })

  if (classification.skip) return

  const db = getAdminFirestore()
  const linkRef = db.collection('links').doc(link.code)

  // Un solo batch: el contador y el evento entran o no entran juntos, para
  // que el detalle de actividad nunca contradiga al número de arriba.
  const batch = db.batch()

  // ¿Este evento mueve el contador de aperturas? Un bot nunca, y una vista
  // dentro de una sesión ya contada tampoco.
  const countsAsOpen = type === 'open' && !classification.isBot && countOpen

  const counters: Record<string, unknown> = {}
  if (type === 'whatsapp') {
    counters.whatsappClicks = FieldValue.increment(1)
  } else if (classification.isBot) {
    counters.botOpens = FieldValue.increment(1)
  } else if (countsAsOpen) {
    counters.opens = FieldValue.increment(1)
    counters.lastOpenAt = FieldValue.serverTimestamp()
    // Personas, no aperturas. `opens` ya no cuenta recargas —el navegador
    // no vuelve a pingear dentro de la misma media hora— pero sí cuenta que
    // la misma persona vuelva mañana, que es justo lo que el vendedor
    // quiere ver. `visitors` es el otro número: cuántas personas distintas.
    if (visitorIsNew) counters.visitors = FieldValue.increment(1)
    // Sólo la primera vez. `create: false` en el merge no existe, así que
    // se resuelve con un campo que sólo se escribe si todavía no está.
    if (!link.firstOpenAt) counters.firstOpenAt = FieldValue.serverTimestamp()
  }
  // Una vista dentro de una sesión ya contada no toca ningún contador: sin
  // este chequeo se escribiría el documento del link igual, para nada.
  if (Object.keys(counters).length) batch.set(linkRef, counters, { merge: true })

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
    visitorNew: visitorIsNew,
    // Sin esto, el detalle de actividad muestra más filas que aperturas y
    // parece que el número de arriba está mal.
    counted: type === 'whatsapp' ? true : countsAsOpen,
  })

  await withTimeout(batch.commit())
}
