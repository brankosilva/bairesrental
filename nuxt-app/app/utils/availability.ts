// Disponibilidad de una propiedad: opciones válidas por tipo y su mapeo a las
// clases del chip del panel. Vive en app/utils/ para que Nuxt lo auto-importe
// (mismo criterio que format.ts).
//
// Las clases son propias del panel (.br-app-status-*) y NO las del catálogo
// público (.br-badge*, en public/css/br-catalog.css): esas son de 11px, muy
// por debajo del piso de 16px que necesita un <select> para que iOS Safari no
// haga auto-zoom al enfocarlo.

export type PropertyKind = 'rental' | 'sale'

export type RentalAvailability = 'disponible' | 'reservado' | 'no disponible'
export type SaleAvailability = 'disponible' | 'reservado' | 'vendido'
export type Availability = RentalAvailability | SaleAvailability

// Alquileres dan de baja con "no disponible"; ventas con "vendido". Los dos
// estados terminales comparten el mismo chip rojo (availabilityClass()).
export const AVAILABILITY_OPTIONS: Record<PropertyKind, readonly Availability[]> = {
  rental: ['disponible', 'reservado', 'no disponible'],
  sale: ['disponible', 'reservado', 'vendido'],
}

export function availabilityClass(disponibilidad: string): string {
  if (disponibilidad === 'disponible') return 'br-app-status-disponible'
  if (disponibilidad === 'reservado') return 'br-app-status-reservado'
  return 'br-app-status-baja'
}
