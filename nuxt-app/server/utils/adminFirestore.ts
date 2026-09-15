// Firestore con privilegios de Admin SDK para rutas Nitro.
//
// Es el complemento de server/utils/serverFirestore.ts, NO su reemplazo:
// aquel usa el SDK cliente y sirve para lecturas que firestore.rules ya
// permite públicamente (el sitemap lee rentals/sales). Este se usa donde
// hace falta saltear las reglas — resolver un link y escribir sus
// contadores. Desde esta milestone `links` dejó de ser públicamente
// legible (lleva el nombre de la persona a la que se le compartió), así
// que la resolución del link SÓLO puede pasar por acá.
//
// `ensureAdminApp()` viene de vuefire/server, que ya está en el bundle de
// SSR (nuxt-vuefire lo arrastra por `auth.sessionCookie: true` en
// nuxt.config.ts — se puede confirmar con
// `grep ensureAdminApp .output/server/chunks/nitro/nitro.mjs`). Resuelve
// las credenciales solo en los dos entornos de este proyecto:
//
//   · desplegado → detecta FIREBASE_CONFIG/FUNCTION_NAME y usa las
//     Application Default Credentials de la service account con la que
//     corre la función nuxtSsr;
//   · local (`nuxt dev`) → usa GOOGLE_APPLICATION_CREDENTIALS, que .env ya
//     apunta a serviceAccountKey.json.
//
// Son dos ramas distintas del código de vuefire, así que que ande en local
// no prueba que ande desplegado: verificar siempre en un canal de preview
// antes de publicar (ver README).
//
// firebase-admin NO es una dependencia nueva: ya figura en
// nuxt-app/package.json y en .output/server/package.json (13.10.0). El
// workaround de `npm install --omit=dev` dentro de .output/server antes de
// cada deploy de funciones sigue igual que siempre.
import { ensureAdminApp } from 'vuefire/server'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const ADMIN_APP_NAME = 'nitro-admin'

let cached: Firestore | null = null

export function getAdminFirestore(): Firestore {
  // Memoizado por instancia de la función: getFirestore() sobre la misma
  // app devuelve el mismo objeto igual, pero así se evita repetir la
  // resolución de credenciales de ensureAdminApp() en cada request.
  if (cached) return cached
  cached = getFirestore(ensureAdminApp(undefined, ADMIN_APP_NAME))
  return cached
}
