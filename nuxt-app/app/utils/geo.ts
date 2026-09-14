// Rentals/sales only ever stored a Google Maps link (direccionUrl), never
// raw coordinates (see property.ts). Most of those links carry a lat/lng
// somewhere in the URL depending on how they were generated — this pulls
// it out client-side instead of requiring a data migration first.
// `maps.app.goo.gl` short links can't be resolved this way (no redirect
// follow from the browser) and simply won't produce a pin.
export function extractLatLng(url?: string | null): [number, number] | null {
  if (!url) return null

  // https://www.google.com/maps?q=-34.598,-58.452
  let m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  // https://www.google.com/maps/place/.../@-34.598,-58.452,17z
  m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  // .../data=...!3d-34.598!4d-58.452...
  m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (m) return [parseFloat(m[1]!), parseFloat(m[2]!)]

  return null
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
