import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_FIREBASE_PROJECT_ID

  // Local dev convenience: fall back to the service account key generated
  // during the M1 migration if the caller hasn't already set
  // GOOGLE_APPLICATION_CREDENTIALS (CI/production should provide their own
  // and this is skipped). Read by firebase-admin internally, not by Vite.
  const localKey = path.resolve(__dirname, 'serviceAccountKey.json')
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(localKey)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = localKey
  }

  return {
    plugins: [vue()],
    ssgOptions: {
      formatting: 'minify',
      includedRoutes: async (paths: string[]) => {
        // Dynamic per-listing routes enumerated from Firestore at build
        // time via the Admin SDK — this is the mechanism validated in M0
        // (see app/CHANGELOG.md) that makes per-listing prerendering work
        // without a request-time server. Runtime data fetching inside the
        // page components themselves goes through src/data/properties.ts,
        // which branches the same way but via src/data/admin.ts.
        const { initializeApp, getApps } = await import('firebase-admin/app')
        const { getFirestore } = await import('firebase-admin/firestore')
        const app = getApps().length ? getApps()[0] : initializeApp({ projectId })
        const db = getFirestore(app)

        const [rentals, sales] = await Promise.all([
          db.collection('rentals').select().get(),
          db.collection('sales').select().get(),
        ])

        // One route per listing per locale (es unprefixed, en under /en) —
        // see src/router/index.ts for the same pattern applied to the
        // static routes.
        return [
          ...paths,
          ...rentals.docs.flatMap((d) => [`/departamentos/${d.id}`, `/en/departamentos/${d.id}`]),
          ...sales.docs.flatMap((d) => [`/ventas/${d.id}`, `/en/ventas/${d.id}`]),
        ]
      },
    },
  }
})
