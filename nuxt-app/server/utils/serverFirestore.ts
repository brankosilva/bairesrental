// Shared plain-client-SDK Firestore accessor for bare Nitro server
// routes that run outside the Vue render pipeline, where nuxt-vuefire's
// own Vue-plugin-driven app init can't be assumed to have already run.
// Same pattern N1's `server/api/__sitemap__/urls.ts` established (a
// dedicated named Firebase app, not the default one) — factored out here
// since N4's `/l/:code` lookup needs the identical setup. Deliberately
// the plain client SDK, not the Admin SDK: `firestore.rules` already
// allows public reads on the collections these callers touch (`rentals`/
// `sales` for the sitemap, `links/{code}` — `allow get: if true` — for
// trackable-link resolution), so no elevated privileges are needed.
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const SERVER_FIRESTORE_APP_NAME = 'server-source'

export function getServerFirestore(): Firestore {
  const { public: publicConfig } = useRuntimeConfig()
  const firebaseConfig = publicConfig.vuefire.config

  const app: FirebaseApp = getApps().some((a) => a.name === SERVER_FIRESTORE_APP_NAME)
    ? getApp(SERVER_FIRESTORE_APP_NAME)
    : initializeApp(firebaseConfig, SERVER_FIRESTORE_APP_NAME)

  return getFirestore(app)
}
