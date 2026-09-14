// Client-SDK Firestore access for the authenticated /app/* pages
// (admin/seller/owner) — these never run during the SSG prerender pass
// (they're excluded from the public catalog's build-time data flow), so
// unlike src/data/properties.ts there's no SSR/client branching needed
// here, just plain authenticated reads/writes gated by firestore.rules.
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore'
import { getFirebaseApp } from '../firebase/client'

function db() {
  return getFirestore(getFirebaseApp())
}

export async function listAll<T>(collectionName: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(collection(db(), collectionName))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listBySeller<T>(collectionName: string, sellerUid: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(db(), collectionName), where('sellerUid', '==', sellerUid)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function listByOwner<T>(collectionName: string, ownerUid: string): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(db(), collectionName), where('ownerUid', '==', ownerUid)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))
}

export async function getOne<T>(collectionName: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db(), collectionName, id))
  return snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null
}

export async function saveOne(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db(), collectionName, id), data, { merge: true })
}

export async function removeOne(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db(), collectionName, id))
}
