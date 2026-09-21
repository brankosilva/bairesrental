// Ported verbatim from app/src/data/properties.ts's interfaces — the
// Firestore document shapes for `rentals`/`sales` haven't changed, only
// how pages fetch them (useDocument/useCollection instead of a hand-rolled
// SSR/CSR fetch split — see docs/catalogo-datos.md for the canonical schema).

import type { EstadoRevision } from '~/utils/revision'

// Los campos que NO describen la propiedad sino su trámite interno: de quién
// es y en qué estado de revisión está. Van aparte de RentalProperty/SaleProperty
// porque el catálogo público no los usa para nada.
//
// Hasta acá esto se escribía a mano en cada pantalla como
// `RentalProperty & { id: string; sellerUid?: string | null }`, repetido en seis
// archivos y por lo tanto siempre a medias — ninguno declaraba `ownerUid`
// aunque el formulario lo guarda.
/**
 * De qué link salió la propiedad, cuando entró por el campo "importar desde
 * ficha" (panel) o por `scripts/add-from-ficha.js`. Queda guardado para poder
 * volver a leer la ficha y refrescar precio y disponibilidad más adelante.
 *
 * No alcanza con `fotos`: en alquileres guarda la misma URL pero es un campo
 * editable (puede terminar apuntando a un álbum de Google Photos), y en venta
 * `fotos` son las fotos de verdad, así que el link no quedaba en ningún lado.
 *
 * Gemelo de `OrigenImport` en functions/src/ficha.ts.
 */
export interface OrigenImport {
  /** Qué ficha: 'ficha.info' (Tokko) o 'fichaprop.tech' (Tencery). */
  fuente: string
  /** La URL canónica, sin el cache-buster. */
  url: string
  /**
   * Cuándo se leyó la ficha por última vez, en ISO. Falta en las propiedades
   * que completó `scripts/backfill-origen.js`: ahí el link se dedujo de lo que
   * ya estaba guardado, sin leer nada.
   */
  leidoEn?: string
}

export interface ListingMeta {
  /** Quién la cargó. Ausente en las ~88 que cargó el admin por script. */
  sellerUid?: string | null
  /**
   * El nombre del vendedor, desnormalizado al guardar.
   *
   * No se resuelve con un get() a `users/{uid}` porque las reglas no le dan a
   * un vendedor lectura sobre el documento de otro usuario, y el panel del
   * vendedor tiene que poder decir de quién es cada publicación del catálogo
   * compartido. Mismo criterio que `links/{code}/opens`, que lleva `sellerUid`
   * desnormalizado para no pagar un get() por evaluación de regla.
   *
   * El email NO se desnormaliza: estas colecciones son de lectura pública y
   * `users.email` es un contacto interno. En el panel admin sale de
   * listAll('users'), que el admin sí puede leer.
   */
  sellerNombre?: string | null
  /** El propietario (portal de dueños, sólo lectura). */
  ownerUid?: string | null
  /**
   * Nombre y contacto del dueño real del depto, para uso interno del equipo
   * (mantenimiento, consultas) — no tiene nada que ver con `ownerUid`: éste
   * es sólo un dato de texto, sin cuenta ni login. Sólo lo ve el admin, nunca
   * sale al catálogo público ni al panel del vendedor.
   */
  propietarioNombre?: string | null
  propietarioContacto?: string | null
  /** El link del que se importó, si entró por una ficha. Ver OrigenImport. */
  origen?: OrigenImport | null
  revision?: EstadoRevision
  /** Lo que el admin le escribe al vendedor al rechazar. Lo limpia al aprobar. */
  motivoRechazo?: string | null
  revisadaPor?: string | null
  revisadaEn?: unknown
  /**
   * Timestamp de Firestore, lo sella adminCrud (saveOne/createOne).
   *
   * Va como `unknown` y no como `Timestamp`: del lado del servidor es el del
   * Admin SDK y del lado del cliente el del SDK web, y quien lo lee ya tiene
   * que desarmarlo a mano (`ts.seconds * 1000`). Los documentos anteriores a
   * N9 no lo tienen.
   */
  updatedAt?: unknown
}

/** Una fila de `rentals` como la leen las pantallas del panel. */
export type RentalRow = RentalProperty & ListingMeta & { id: string }
/** Una fila de `sales` como la leen las pantallas del panel. */
export type SaleRow = SaleProperty & ListingMeta & { id: string }

export interface RentalProperty {
  id: string
  titulo: string
  barrio: string
  tipo: string
  precio: number
  moneda: 'USD' | 'ARS'
  disponibilidad: 'disponible' | 'reservado' | 'no disponible'
  disponibleDesde?: string
  amueblado: boolean
  mascotas: boolean
  serviciosIncluidos: boolean
  minimoMeses: number
  // Sólo para el puñado de propiedades que se alquilan por día (quintas,
  // fines de semana) en vez de por mes. Si está presente, manda por sobre
  // minimoMeses en toda pantalla que muestre la estadía mínima.
  minimoDias?: number
  amenities: string[]
  descripcion: string
  imagen: string
  fotos: string
  fichaUrl?: string
  direccion?: string
  direccionUrl?: string
  // Coordenadas del pin del mapa. Las escribe scripts/resolve-map-coords.js;
  // si faltan, el mapa cae a parsear direccionUrl. Ver utils/geo.ts.
  lat?: number
  lng?: number
  whatsappMsg?: string
  esPropio: boolean
}

export interface SaleProperty {
  id: string
  titulo: string
  barrio: string
  tipo: string
  precio: number
  moneda: 'USD' | 'ARS'
  disponibilidad: 'disponible' | 'reservado' | 'vendido'
  superficie: number
  superficieCubierta?: number
  ambientes?: number
  banios?: number
  antiguedad?: string
  expensas?: number
  aptoCredito: boolean
  amueblado: boolean
  amenities: string[]
  descripcion: string
  fotos: string[]
  direccion?: string
  direccionUrl?: string
  lat?: number
  lng?: number
  whatsappMsg?: string
  fichaUrl?: string
  esPropio: boolean
}
