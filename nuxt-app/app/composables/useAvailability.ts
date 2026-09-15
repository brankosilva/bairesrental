import { ref } from 'vue'
import { saveOne } from '~/utils/adminCrud'
import type { Availability } from '~/utils/availability'

// Cambio rápido de disponibilidad desde las listas del panel (N9), compartido
// por admin/rentals, admin/sales y seller/listings. `firestore.rules` ya
// permite este update para un admin y para el vendedor dueño de la propiedad,
// así que no hizo falta tocar las reglas.
//
// ESCRITURA PESIMISTA, NO OPTIMISTA. El objeto local se actualiza recién
// cuando la escritura se resolvió (mismo criterio que seller/leads.vue:52-60).
// Un update de un campo tarda 200-400ms: no hay nada que esconder detrás de un
// update optimista, y sí hay algo que romper — ver abajo.
//
// LOS DOS MODOS DE FALLA SON DISTINTOS, y es la parte no obvia de este archivo:
//
//   1. La promesa RECHAZA (permission-denied, ~200ms). Falla real: no se toca
//      el objeto local y se avisa.
//
//   2. La promesa NO SE RESUELVE NUNCA. Este es el caso sin señal, que en un
//      celular es el caso frecuente. setDoc() sólo resuelve con ack del
//      servidor, pero el SDK de Firestore igual encola la escritura local y la
//      manda cuando vuelve la conexión: o sea que el cambio SÍ se va a aplicar.
//      Por eso acá se corre contra un timer y, al vencerse, se aplica el valor
//      igual y se avisa que está pendiente. Revertir sería lo incorrecto: la
//      escritura encolada aterrizaría después y contradiría la pantalla.
const OFFLINE_TIMEOUT_MS = 7000

export interface AvailabilityNotice {
  text: string
  tone: 'danger' | 'info'
}

export function useAvailability(collectionName: 'rentals' | 'sales') {
  const savingId = ref<string | null>(null)
  const notice = ref<AvailabilityNotice | null>(null)

  async function setAvailability<T extends { id: string; disponibilidad: Availability }>(
    item: T,
    next: Availability,
  ): Promise<void> {
    const prev = item.disponibilidad
    if (prev === next) return

    savingId.value = item.id
    notice.value = null

    const write = saveOne(collectionName, item.id, { disponibilidad: next })
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

      item.disponibilidad = next

      if (pending) {
        notice.value = {
          text: 'Sin conexión. El cambio queda guardado y se sincroniza solo cuando vuelva la señal.',
          tone: 'info',
        }
        // La escritura sigue viva. Si al reconectar termina rechazando (por
        // ejemplo, se le sacó el rol al vendedor mientras tanto), hay que
        // deshacer lo que ya se mostró — salvo que el usuario lo haya vuelto a
        // cambiar a mano en el medio.
        write.catch(() => {
          if (item.disponibilidad === next) item.disponibilidad = prev
          notice.value = { text: `No se pudo guardar el cambio en "${item.id}". Volvé a intentar.`, tone: 'danger' }
        })
      }
    } catch {
      notice.value = { text: `No se pudo cambiar la disponibilidad de "${item.id}".`, tone: 'danger' }
    } finally {
      savingId.value = null
    }
  }

  return { savingId, notice, setAvailability }
}
