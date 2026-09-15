// Ported verbatim from app/src/data/properties.ts's interfaces — the
// Firestore document shapes for `rentals`/`sales` haven't changed, only
// how pages fetch them (useDocument/useCollection instead of a hand-rolled
// SSR/CSR fetch split — see docs/catalogo-datos.md for the canonical schema).

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
  amenities: string[]
  descripcion: string
  imagen: string
  fotos: string
  fichaUrl?: string
  direccion?: string
  direccionUrl?: string
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
  whatsappMsg?: string
  fichaUrl?: string
  esPropio: boolean
}
