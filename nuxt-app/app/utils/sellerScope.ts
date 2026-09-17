// Qué publicaciones alcanza un vendedor.
//
// Hasta acá, todo lo del vendedor —su lista del panel, el selector de links y
// el catálogo de la página con su marca— filtraba por `sellerUid == su uid`.
// Pero el catálogo lo carga el admin: los 88 documentos de `rentals`/`sales`
// están SIN `sellerUid`. O sea que el vendedor abría "Mis propiedades" y veía
// cero, y un link de "todo mi catálogo" renderizaba "No hay propiedades
// disponibles". La feature entera estaba apagada por los datos reales.
//
// La regla ahora: TODO el catálogo se comparte. Las que gestiona
// BairesRental (sin `sellerUid`), las que cargó él y también las exclusivas
// que cargó otro vendedor.
//
// Ése es el cambio: hasta acá la exclusiva de un colega quedaba afuera para
// que nadie la mostrara bajo su nombre y su WhatsApp. Es una decisión del
// negocio, no técnica, y la decisión pasó a ser la contraria — el equipo
// comparte un solo catálogo y cada uno lo presenta con su marca. Quién puede
// EDITAR una publicación no cambió: eso sigue siendo `isOwnListing()`.
//
// Se importa explícito desde server/ (que no tiene los auto-imports de la app)
// para que cliente y servidor no puedan quedar con criterios distintos.

import { estaPublicada, type Revisable } from '~/utils/revision'

export interface SellerScoped {
  sellerUid?: string | null
}

/** La cargó este vendedor: es la única que puede editar. */
export function isOwnListing(p: SellerScoped, uid: string | null | undefined): boolean {
  return !!uid && !!p.sellerUid && p.sellerUid === uid
}

/**
 * La puede mostrar y generar links con su marca: todo el catálogo, pero sólo
 * lo que ya aprobó un admin.
 *
 * El recorte por vendedor sigue sin existir (la decisión de N10: el equipo
 * comparte un catálogo solo, y la exclusiva de un colega se comparte igual).
 * Lo único que saca de acá es el estado de revisión: una publicación que
 * todavía no se revisó, o que se rechazó, no está para mostrársela a nadie.
 *
 * Éste sigue siendo el único lugar donde vive la decisión, y por eso vale de
 * una sola vez para el selector de links, el callable que los crea y la página
 * compartida. La excepción es la lista del panel del vendedor, que suma sus
 * propias pendientes con isOwnListing(): son justamente las que tiene que ver
 * para corregirlas.
 */
export function isShareableBySeller(p: SellerScoped & Revisable, _uid: string | null | undefined): boolean {
  return estaPublicada(p)
}

/**
 * Las suyas primero y después por título: lo propio es lo que busca antes.
 * Sigue importando aunque el catálogo sea de todos — en la lista del panel
 * es el orden útil, y en la página compartida hace que la portada del
 * preview salga de una publicación suya.
 */
export function ownFirst<T extends SellerScoped & { titulo?: string }>(uid: string | null | undefined) {
  return (a: T, b: T): number => {
    const rank = Number(isOwnListing(b, uid)) - Number(isOwnListing(a, uid))
    return rank !== 0 ? rank : (a.titulo || '').localeCompare(b.titulo || '', 'es')
  }
}

/**
 * Como ownFirst(), pero antes le da prioridad a lo que administra BairesRental
 * (`esPropio`) — a pedido, para que la lista del panel del vendedor y la
 * página compartida (/l/:code) muestren primero el inventario propio y recién
 * después lo suyo y lo de sus colegas, igual que el catálogo público.
 */
export function catalogOrder<T extends SellerScoped & { titulo?: string; esPropio?: boolean }>(
  uid: string | null | undefined,
) {
  const ordenPropio = ownFirst<T>(uid)
  return (a: T, b: T): number => {
    const rank = Number(!!b.esPropio) - Number(!!a.esPropio)
    return rank !== 0 ? rank : ordenPropio(a, b)
  }
}
