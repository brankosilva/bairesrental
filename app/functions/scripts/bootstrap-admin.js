#!/usr/bin/env node
// One-time bootstrap: makes an existing Firebase Auth user an admin,
// directly via the Admin SDK. Needed because setUserRole (the Cloud
// Function) requires the CALLER to already be an admin — there's no
// admin yet the first time this runs. Every admin after the first one
// should be created via setUserRole (or the M5 admin app once it exists),
// not this script.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//   node functions/scripts/bootstrap-admin.js <email>
//
// The user must already exist in Firebase Auth (create one first via the
// Firebase console, `firebase auth:import`, or the client SDK's sign-up
// flow) — this script only grants the role, it doesn't create accounts.

const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Uso: node functions/scripts/bootstrap-admin.js <email>')
    process.exit(1)
  }

  initializeApp()
  const auth = getAuth()
  const db = getFirestore()

  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, { role: 'admin' })
  await db.collection('users').doc(user.uid).set(
    { email: user.email, role: 'admin', updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  console.log(`✅ ${email} (${user.uid}) es admin ahora. Tiene que cerrar sesión y volver a entrar (o esperar a que se refresque el token) para que el rol se vea reflejado.`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
