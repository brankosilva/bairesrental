import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

// Node-only — must never be imported from client-side code. Only reached
// via a dynamic `import('./admin')` inside the `if (import.meta.env.SSR)`
// branch of src/data/properties.ts, so bundlers never need to resolve
// firebase-admin (a large, Node-native package) for the browser build.
//
// Used during the vite-ssg prerender pass (both here, and directly inside
// vite.config.ts's includedRoutes hook for route enumeration — see there).
// Auth: GOOGLE_APPLICATION_CREDENTIALS env var, or the local
// serviceAccountKey.json fallback vite.config.ts wires up for dev builds.

let db: Firestore | undefined

export function getFirestoreAdmin(): Firestore {
  if (!db) {
    const app = getApps().length ? getApps()[0] : initializeApp({ projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID })
    db = getFirestore(app)
  }
  return db
}
