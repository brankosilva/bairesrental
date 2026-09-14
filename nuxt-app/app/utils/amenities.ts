// Ported verbatim from app/src/data/amenities.ts — shared amenity → emoji
// map used by the detail pages' plain badge list (departamentos/ventas
// catalog pages use their own richer AMENITY_META with i18n keys, kept
// inline in each page like the old Departamentos.vue did).
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
