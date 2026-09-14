export function formatPrice(precio: number, moneda: string): string {
  if (!precio) return 'Consultar precio'
  return `${moneda} ${precio.toLocaleString('es-AR')}`
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/5491173735757?text=${encodeURIComponent(message)}`
}

export function truncate(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
