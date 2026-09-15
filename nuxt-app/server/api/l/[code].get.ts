import type { SellerProfile, TrackableLink } from '~/types/link'

// Payload de la página con la marca del vendedor (/l/:code).
//
// Es SÓLO lectura: el registro de la apertura lo hace
// server/middleware/01.link-open.ts, que es quien ve la request real del
// visitante (User-Agent, x-forwarded-for). Si el conteo viviera acá, este
// endpoint también se llamaría desde el cliente al navegar dentro de la
// página y contaría aperturas que nunca pasaron.
//
// Lee con el Admin SDK porque `links` dejó de ser público: los documentos
// llevan el nombre de la persona a la que el vendedor le compartió el link
// (ver firestore.rules).

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
  let profile: SellerProfile | null = null
  if (link.sellerUid) {
    const p = await db.collection('sellerProfiles').doc(link.sellerUid).get()
    if (p.exists) profile = plain(p.data() as Record<string, unknown>) as unknown as SellerProfile
    if (!profile || !profile.displayName) {
      const u = await db.collection('users').doc(link.sellerUid).get()
      const name = (u.data()?.displayName as string) || (u.data()?.email as string) || 'Tu asesor'
      profile = { ...(profile ?? ({} as SellerProfile)), uid: link.sellerUid, displayName: name } as SellerProfile
    }
  }

  const targetId = requestedProperty || link.propertyId
  const isCatalog = link.target === 'catalog' && !requestedProperty

  let property: Record<string, unknown> | null = null
  let propertyKind: 'rental' | 'sale' | null = null
  let catalog: { rentals: Record<string, unknown>[]; sales: Record<string, unknown>[] } | null = null

  if (isCatalog) {
    // El catálogo del vendedor: SUS publicaciones, no las de BairesRental.
    const [r, s] = await Promise.all([
      db.collection('rentals').where('sellerUid', '==', link.sellerUid).get(),
      db.collection('sales').where('sellerUid', '==', link.sellerUid).get(),
    ])
    // Se esconde lo no disponible/vendido, igual que en el catálogo público:
    // mandarle a un cliente una lista con cosas que ya no están es peor que
    // mandarle una lista más corta.
    catalog = {
      rentals: r.docs
        .map((d) => ({ id: d.id, ...plain(d.data()) }) as Record<string, unknown>)
        .filter((p) => p.disponibilidad !== 'no disponible'),
      sales: s.docs
        .map((d) => ({ id: d.id, ...plain(d.data()) }) as Record<string, unknown>)
        .filter((p) => p.disponibilidad !== 'vendido'),
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
        property = { id: d.id, ...plain(d.data() as Record<string, unknown>) }
        propertyKind = kind
        break
      }
    }
    if (!property) throw createError({ statusCode: 404, statusMessage: 'Publicación no encontrada' })

    // Un link de catálogo sólo puede abrir fichas DE ESE vendedor: sin este
    // chequeo, /l/<mi-code>?p=<cualquier-id> renderizaría la publicación de
    // otro con mi nombre y mi WhatsApp encima.
    if (requestedProperty && property.sellerUid !== link.sellerUid) {
      throw createError({ statusCode: 404, statusMessage: 'Publicación no encontrada' })
    }
  }

  return {
    code,
    target: link.target ?? (link.propertyId ? 'property' : 'catalog'),
    recipientName: link.recipientName ?? null,
    seller: profile,
    property,
    propertyKind,
    catalog,
  }
})
