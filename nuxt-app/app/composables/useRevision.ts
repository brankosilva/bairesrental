import { ref } from 'vue'
import { saveOne } from '~/utils/adminCrud'
import type { EstadoRevision } from '~/utils/revision'

// Aprobar / rechazar una publicación desde la cola del admin.
//
// Calcado de useAvailability(): es la misma escritura de un par de campos desde
// un celular, y los dos modos de falla ya están resueltos ahí. Ver el
// encabezado de ese archivo para el razonamiento completo; el resumen es que la
// escritura es PESIMISTA (el objeto local se toca recién cuando el servidor
// confirmó) pero con un timer, porque sin señal la promesa de setDoc() no
// resuelve nunca aunque el SDK ya haya encolado el cambio y lo vaya a mandar.
//
// Va DIRECTO a Firestore y no por un callable: firestore.rules ya le permite al
// admin escribir el documento entero, y el motivo por el que /users está detrás
// de callables —que el claim de Auth y el documento no diverjan— acá no aplica,
// no hay nada que pueda quedar desincronizado.
const OFFLINE_TIMEOUT_MS = 7000

export interface RevisionNotice {
  text: string
  tone: 'danger' | 'info'
}

export interface RevisableRow {
  id: string
  titulo?: string
  revision?: EstadoRevision
  motivoRechazo?: string | null
}

export function useRevision(collectionName: 'rentals' | 'sales') {
  const savingId = ref<string | null>(null)
  const notice = ref<RevisionNotice | null>(null)

  async function setRevision<T extends RevisableRow>(
    item: T,
    next: EstadoRevision,
    motivo: string | null,
    revisadaPor: string | null,
  ): Promise<boolean> {
    const prevRevision = item.revision
    const prevMotivo = item.motivoRechazo ?? null

    savingId.value = item.id
    notice.value = null

    // Aprobar limpia el motivo del rechazo anterior: si no, la publicación
    // queda publicada y arrastrando el texto de por qué se había rechazado, que
    // es lo que después se le muestra al vendedor.
    const campos = {
      revision: next,
      motivoRechazo: next === 'rechazada' ? motivo : null,
      revisadaPor,
      revisadaEn: new Date(),
    }

    const write = saveOne(collectionName, item.id, campos)
    let pending = false

    try {
      await Promise.race([
        write,
        new Promise<void>((resolve) =>
          setTimeout(() => {
            pending = true
            resolve()
          }, OFFLINE_TIMEOUT_MS),
        ),
      ])

      item.revision = next
      item.motivoRechazo = campos.motivoRechazo

      if (pending) {
        notice.value = {
          text: 'Sin conexión. El cambio queda guardado y se sincroniza solo cuando vuelva la señal.',
          tone: 'info',
        }
        write.catch(() => {
          if (item.revision === next) {
            item.revision = prevRevision
            item.motivoRechazo = prevMotivo
          }
          notice.value = { text: `No se pudo guardar la revisión de "${item.id}". Volvé a intentar.`, tone: 'danger' }
        })
      }

      return true
    } catch {
      notice.value = { text: `No se pudo revisar "${item.id}".`, tone: 'danger' }
      return false
    } finally {
      savingId.value = null
    }
  }

  return { savingId, notice, setRevision }
}
