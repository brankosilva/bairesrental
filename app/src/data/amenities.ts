// Shared amenity → emoji map, matching the filter chips on the current
// departamentos.html/ventas.html (see docs/catalogo-datos.md for the
// canonical list of valid amenity values).
export const AMENITY_EMOJI: Record<string, string> = {
  pileta: '🏊',
  gimnasio: '🏋️',
  laundry: '🫧',
  parrilla: '🔥',
  terraza: '🌿',
  cochera: '🚗',
  sauna: '♨️',
  solárium: '☀️',
  'seguridad 24hs': '🔒',
  jacuzzi: '🛁',
  lavarropas: '🧺',
}

export function amenityLabel(a: string): string {
  const emoji = AMENITY_EMOJI[a]
  return emoji ? `${emoji} ${a}` : a
}
