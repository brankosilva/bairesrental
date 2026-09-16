// Ported from app/src/data/adminCrud.ts — same one-shot Firestore
// operations (list/get/save/delete) for the authenticated /app/*
// admin/seller/owner pages, but sourced from nuxt-vuefire's canonical
// Firebase app instance (useFirestore()) instead of a second hand-rolled
// app singleton (the old app/src/firebase/client.ts's getFirebaseApp()).
//
// Explicit `import { useFirestore } from 'vuefire'` rather than relying on
// Nuxt's auto-import transform inside this plain utils file — useFirestore()
// internally falls back to firebase/app's getApp() when there's no active
// Vue component instance to inject from (confirmed in
// node_modules/vuefire/dist/shared/vuefire.*.mjs), so it's safe to call
// from anywhere, anytime, including deep inside an onMounted callback
// after an `await` — no different from the old singleton-based approach.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import { useFirestore } from 'vuefire'

export async function listAll<T>(collectionName: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(collection(useFirestore(), collectionName))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listBySeller<T>(collectionName: string, sellerUid: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(useFirestore(), collectionName), where('sellerUid', '==', sellerUid)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listByOwner<T>(collectionName: string, ownerUid: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(useFirestore(), collectionName), where('ownerUid', '==', ownerUid)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function getOne<T>(collectionName: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(useFirestore(), collectionName, id))
  return snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null
}

// `updatedAt` se sella acá y no en cada pantalla a propósito. Son cuatro call
// sites (los dos formularios × su guardado principal + su escritura de fotos
// posterior) más el cambio rápido de disponibilidad desde las listas; ponerlo
// en un solo lugar evita que la próxima pantalla que escriba se olvide.
//
// Hasta N9 NADA escribía este campo, así que la columna "Actualizado" de
// owner/index.vue siempre mostraba "—". Los documentos ya existentes lo ganan
// recién la primera vez que se vuelven a guardar; no hay backfill.
//
// serverTimestamp() devuelve un *sentinel* (FieldValue), no un Timestamp: se
// resuelve en el servidor. Nunca asignarlo al objeto local de una lista —
// owner/index.vue hace `ts.seconds * 1000` y daría Invalid Date.
export async function saveOne(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(useFirestore(), collectionName, id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

// El `id` de una propiedad ES el id del documento y también su URL pública
// (/departamentos/marie-01), así que lo tipea una persona en el formulario.
//
// Hasta acá el alta usaba saveOne(), o sea un setDoc({ merge: true }): repetir
// un id sin querer no fallaba, se MEZCLABA con la propiedad que ya estaba.
// Le pisaba título, precio y fotos, y le dejaba los campos que el formulario no
// manda (sellerUid, ownerUid, updatedAt) del dueño anterior — sin aviso, sin
// vuelta atrás y sin que quedara rastro de la propiedad original.
export class DuplicateIdError extends Error {
  constructor(
    readonly collectionName: string,
    readonly duplicatedId: string,
  ) {
    super(`Ya existe una propiedad con el ID "${duplicatedId}".`)
    this.name = 'DuplicateIdError'
  }
}

// Alta: falla si el id ya está tomado, en vez de pisar lo que haya.
//
// Va en una transacción y no en un getDoc() + setDoc() para que el chequeo y la
// escritura sean atómicos: entre leer y escribir no se puede colar otra alta del
// mismo slug. Y `set` sin merge a propósito — un alta arranca de cero, no hereda
// campos sueltos de un documento que no debería existir.
export async function createOne(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = useFirestore()
  const ref = doc(db, collectionName, id)
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) throw new DuplicateIdError(collectionName, id)
    tx.set(ref, { ...data, updatedAt: serverTimestamp() })
  })
}

// Para avisar del id repetido apenas se sale del campo, sin que haya que llenar
// el formulario entero (y en ventas, subir hasta 20 fotos) para enterarse.
// createOne() sigue siendo la validación que manda; esto es sólo el aviso.
export async function idExists(collectionName: string, id: string): Promise<boolean> {
  return (await getDoc(doc(useFirestore(), collectionName, id))).exists()
}

export async function removeOne(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(useFirestore(), collectionName, id))
}
