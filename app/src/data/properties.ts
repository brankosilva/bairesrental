// Build-time (Node, during the vite-ssg prerender pass) vs. runtime
// (browser, after hydration) data-fetch split — the crux of doing SSG
// against Firestore without a request-time server (see the approved plan
// and app/CHANGELOG.md M0 entry). `import.meta.env.SSR` is statically
// known by Vite, so the unused branch's imports are dropped from whichever
// bundle doesn't need them (the admin SDK never reaches the client build).
//
// Scope note (M2): these do one-time fetches on both sides rather than
// live VueFire subscriptions — sufficient to prove out prerendering +
// per-page SEO. Wiring VueFire's reactive useCollection/useDocument for
// live updates after hydration is a follow-up, not required for this
// milestone.

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

async function fetchCollection<T>(name: string): Promise<T[]> {
  if (import.meta.env.SSR) {
    const { getFirestoreAdmin } = await import('./admin')
    const snap = await getFirestoreAdmin().collection(name).get()
    return snap.docs.map((d) => d.data() as T)
  }
  const { getFirestore, collection, getDocs } = await import('firebase/firestore')
  const { getFirebaseApp } = await import('../firebase/client')
  const snap = await getDocs(collection(getFirestore(getFirebaseApp()), name))
  return snap.docs.map((d) => d.data() as T)
}

async function fetchDoc<T>(name: string, id: string): Promise<T | null> {
  if (import.meta.env.SSR) {
    const { getFirestoreAdmin } = await import('./admin')
    const snap = await getFirestoreAdmin().collection(name).doc(id).get()
    return snap.exists ? (snap.data() as T) : null
  }
  const { getFirestore, doc, getDoc } = await import('firebase/firestore')
  const { getFirebaseApp } = await import('../firebase/client')
  const snap = await getDoc(doc(getFirestore(getFirebaseApp()), name, id))
  return snap.exists() ? (snap.data() as T) : null
}

// Excludes "no disponible" listings, matching js/departamentos.js's
// existing behavior on the current static site.
export async function getAllRentals(): Promise<RentalProperty[]> {
  const rentals = await fetchCollection<RentalProperty>('rentals')
  return rentals.filter((r) => r.disponibilidad !== 'no disponible')
}

export async function getRental(id: string): Promise<RentalProperty | null> {
  return fetchDoc<RentalProperty>('rentals', id)
}

// Excludes "vendido" listings, matching the sales catalog's existing
// behavior (see docs/catalogo-datos.md).
export async function getAllSales(): Promise<SaleProperty[]> {
  const sales = await fetchCollection<SaleProperty>('sales')
  return sales.filter((s) => s.disponibilidad !== 'vendido')
}

export async function getSale(id: string): Promise<SaleProperty | null> {
  return fetchDoc<SaleProperty>('sales', id)
}
