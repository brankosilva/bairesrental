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
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore'
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

export async function saveOne(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(useFirestore(), collectionName, id), data, { merge: true })
}

export async function removeOne(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(useFirestore(), collectionName, id))
}
