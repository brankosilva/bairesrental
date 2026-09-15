// Qué publicaciones alcanza un vendedor.
//
// Hasta acá, todo lo del vendedor —su lista del panel, el selector de links y
// el catálogo de la página con su marca— filtraba por `sellerUid == su uid`.
// Pero el catálogo lo carga el admin: los 88 documentos de `rentals`/`sales`
// están SIN `sellerUid`. O sea que el vendedor abría "Mis propiedades" y veía
// cero, y un link de "todo mi catálogo" renderizaba "No hay propiedades
// disponibles". La feature entera estaba apagada por los datos reales.
//
// La regla ahora: una publicación es suya para ver y compartir si la gestiona
// BairesRental (sin `sellerUid`) o si la cargó él.
//
// LAS DE OTRO VENDEDOR SIGUEN AFUERA, y eso es a propósito: renderizar la
// exclusiva de un colega bajo el propio nombre y el propio WhatsApp es el caso
// que el chequeo anterior evitaba (ver server/api/l/[code].get.ts), y no es lo
// que se pidió abrir. Si alguna vez se decide que el equipo comparte todo,
// `isShareableBySeller` pasa a devolver true y no hay que tocar nada más.
//
// Se importa explícito desde server/ (que no tiene los auto-imports de la app)
// para que cliente y servidor no puedan quedar con criterios distintos.

export interface SellerScoped {
  sellerUid?: string | null
}

/** La cargó este vendedor: es la única que puede editar. */
export function isOwnListing(p: SellerScoped, uid: string | null | undefined): boolean {
  return !!uid && !!p.sellerUid && p.sellerUid === uid
}

/** La puede ver y generar links con su marca. */
export function isShareableBySeller(p: SellerScoped, uid: string | null | undefined): boolean {
  return !p.sellerUid || isOwnListing(p, uid)
}

/** Las suyas primero y después por título: lo propio es lo que busca antes. */
export function ownFirst<T extends SellerScoped & { titulo?: string }>(uid: string | null | undefined) {
  return (a: T, b: T): number => {
    const rank = Number(isOwnListing(b, uid)) - Number(isOwnListing(a, uid))
    return rank !== 0 ? rank : (a.titulo || '').localeCompare(b.titulo || '', 'es')
  }
}
