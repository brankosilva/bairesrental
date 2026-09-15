import type { SellerProfile, TrackableLink } from '~/types/link'
import { isShareableBySeller, ownFirst } from '~/utils/sellerScope'

// Payload de la página con la marca del vendedor (/l/:code).
//
// Es SÓLO lectura: el registro de la apertura lo hace
// server/middleware/01.link-open.ts, que es quien ve la request real del
// visitante (User-Agent, x-forwarded-for). Si el conteo viviera acá, este
// endpoint también se llamaría desde el cliente al navegar dentro de la
// página y contaría aperturas que nunca pasaron.
//
// Lee con el Admin SDK porque `links` dejó de ser público: los documentos
// llevan la etiqueta con la que el vendedor identifica al destinatario (ver
// firestore.rules). Esa etiqueta NO sale en el payload: es una anotación
// interna suya, no un dato de la persona que abre la página.

// Los docs de rentals/sales tienen `updatedAt` (Timestamp del Admin SDK,
// lo escribe adminCrud.saveOne). JSON.stringify lo convierte en
// {_seconds,_nanoseconds}, que no le sirve a nadie del otro lado y encima
// viaja en el payload de SSR. Se limpia acá.
function plain<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') continue
    out[k] = v
  }
  return out as T
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) throw createError({ statusCode: 404, statusMessage: 'Link no encontrado' })

  const db = getAdminFirestore()
  const snap = await db.collection('links').doc(code).get()
  if (!snap.exists) throw createError({ statusCode: 404, statusMessage: 'Link no encontrado' })

  const link = snap.data() as TrackableLink
  // 410 Gone, no 404: el link existió y el vendedor lo apagó. Son cosas
  // distintas y el visitante merece un mensaje distinto.
  if (link.active === false) throw createError({ statusCode: 410, statusMessage: 'Link desactivado' })

  // Permite que /l/:code/:propertyId (una ficha abierta desde un link de
  // catálogo) reuse este mismo endpoint.
  const requestedProperty = (getQuery(event).p as string | undefined) || null

  // La ficha pública del vendedor. Si todavía no la cargó, se cae al nombre
  // del usuario para que la página nunca salga sin identidad — que es
  // justamente lo único que la hace "su" página.
  //
  // `sellerFallback` marca el caso en que ni siquiera eso alcanzó y quedó el
  // genérico "Tu asesor" (hay links en producción cuyo sellerUid ya no existe
  // en `users`). La página lo muestra igual —mejor un contacto genérico que
  // ninguno—, pero los <meta> del preview tienen que saberlo: "Propiedades de
  // Tu asesor" pegado en un WhatsApp se lee directamente como un error.
  let profile: SellerProfile | null = null
  let sellerFallback = false
  if (link.sellerUid) {
    const p = await db.collection('sellerProfiles').doc(link.sellerUid).get()
    if (p.exists) profile = plain(p.data() as Record<string, unknown>) as unknown as SellerProfile
    if (!profile || !profile.displayName) {
      const u = await db.collection('users').doc(link.sellerUid).get()
      const name = (u.data()?.displayName as string) || (u.data()?.email as string) || null
      sellerFallback = !name
      profile = {
        ...(profile ?? ({} as SellerProfile)),
        uid: link.sellerUid,
        displayName: name || 'Tu asesor',
      } as SellerProfile
    }
  }

  const targetId = requestedProperty || link.propertyId
  const isCatalog = link.target === 'catalog' && !requestedProperty

  // Los dos campos que este endpoint mira por nombre salen del índice de
  // strings: con `Record<string, unknown>` a secas, `sellerUid` es `unknown` y
  // no entra en SellerScoped.
  type Row = Record<string, unknown> & { sellerUid?: string | null; titulo?: string }

  let property: Row | null = null
  let propertyKind: 'rental' | 'sale' | null = null
  let catalog: { rentals: Row[]; sales: Row[] } | null = null

  if (isCatalog) {
    // El catálogo que el vendedor presenta como propio: el de BairesRental
    // más lo que cargó él.
    //
    // Antes eran dos queries `where('sellerUid', '==', ...)`, o sea sólo lo
    // suyo — y como ningún documento del catálogo tiene `sellerUid`, esta
    // página salía siempre con "No hay propiedades disponibles". Ahora se
    // leen las dos colecciones enteras y el recorte lo hace
    // isShareableBySeller(), que también deja afuera la exclusiva de otro
    // vendedor. Son ~88 lecturas por apertura: exactamente lo mismo que ya
    // hace /departamentos en cada request de SSR.
    const [r, s] = await Promise.all([db.collection('rentals').get(), db.collection('sales').get()])
    const rows = (snap: typeof r) =>
      snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }) as Row).filter((p) => isShareableBySeller(p, link.sellerUid))
    // Se esconde lo no disponible/vendido, igual que en el catálogo público:
    // mandarle a un cliente una lista con cosas que ya no están es peor que
    // mandarle una lista más corta. Las del vendedor van primero: son las
    // únicas de la lista que son suyas de verdad.
    catalog = {
      rentals: rows(r)
        .filter((p) => p.disponibilidad !== 'no disponible')
        .sort(ownFirst(link.sellerUid)),
      sales: rows(s)
        .filter((p) => p.disponibilidad !== 'vendido')
        .sort(ownFirst(link.sellerUid)),
    }
  } else if (targetId) {
    // Cuando viene ?p= (ficha dentro de un link de catálogo) no se sabe de
    // antemano si es alquiler o venta: se prueban los dos.
    const kinds: ('rental' | 'sale')[] = link.propertyType
      ? [link.propertyType, link.propertyType === 'rental' ? 'sale' : 'rental']
      : ['rental', 'sale']
    for (const kind of kinds) {
      const d = await db.collection(kind === 'rental' ? 'rentals' : 'sales').doc(targetId).get()
      if (d.exists) {
        property = { id: d.id, ...plain(d.data() as Record<string, unknown>) } as Row
        propertyKind = kind
        break
      }
    }
    if (!property) throw createError({ statusCode: 404, statusMessage: 'Publicación no encontrada' })

    // Un link de catálogo sólo abre fichas que ese vendedor puede mostrar:
    // sin este chequeo, /l/<mi-code>?p=<cualquier-id> renderizaría la
    // publicación de OTRO VENDEDOR con mi nombre y mi WhatsApp encima. Las de
    // BairesRental sí entran — son las que se acaban de listar arriba.
    if (requestedProperty && !isShareableBySeller(property, link.sellerUid)) {
      throw createError({ statusCode: 404, statusMessage: 'Publicación no encontrada' })
    }
  }

  return {
    code,
    target: link.target ?? (link.propertyId ? 'property' : 'catalog'),
    seller: profile,
    sellerFallback,
    property,
    propertyKind,
    catalog,
  }
})
