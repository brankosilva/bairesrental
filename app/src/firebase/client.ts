import { initializeApp, type FirebaseApp } from 'firebase/app'

// Client-side Firebase SDK — used in the browser after hydration (VueFire
// bindings, Auth, client Storage uploads). The prerender build pass (Node,
// running under vite-ssg) must NOT import this module; it reads data via
// firebase-admin instead (see scripts/migrate-to-firestore.js for the Admin
// SDK pattern that the M2 build-time data layer will reuse).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined

// Lazy singleton: only initialized when first called from client-side code,
// so importing this file during the SSG build pass is a no-op until used.
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}
