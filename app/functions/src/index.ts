// M4: onUserCreate (profile bootstrap) + setUserRole (admin-only role
// assignment). M6 adds createTrackableLink + submitLead (the seller CRM
// feature). M7 adds submitContactForm (the home page contact form, moved
// server-side to stop exposing the Web3Forms key client-side, later
// reverted — see the note at the bottom of this file). M8 adds the
// legacy URL redirect functions (legacyDetailRedirect,
// legacyVentaDetailRedirect) — see app/CHANGELOG.md's M8 entry. M8 also
// added a rebuild-on-data-change automation subsystem
// (onRentalWrite/onSaleWrite + scheduledRebuildCheck), since removed by
// N5 of the Nuxt SSR migration (see nuxt-app/CHANGELOG.md and
// app/CHANGELOG.md's N5 entry) — real per-request SSR reads Firestore
// live on every request, so there's nothing left to "rebuild."
import * as functionsV1 from 'firebase-functions/v1'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

initializeApp()
const db = getFirestore()
const auth = getAuth()

// Closest Cloud Functions v2 region to Buenos Aires, matching the
// Firestore database's region (see app/CHANGELOG.md M1). v1 Auth triggers
// (onUserCreate, below) don't support region selection and stay on the
// gen1 default.
setGlobalOptions({ region: 'southamerica-east1' })

export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  await db.collection('users').doc(user.uid).set({
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    phone: user.phoneNumber ?? null,
    role: null,
    createdAt: FieldValue.serverTimestamp(),
  })
})

const VALID_ROLES = ['admin', 'seller', 'owner'] as const
type Role = (typeof VALID_ROLES)[number]

interface SetUserRoleRequest {
  uid?: string
  role?: Role
}

// Callable, admin-only. The very first admin can't be created through this
// function (nothing is admin yet) — that one-time bootstrap is done
// directly via the Admin SDK (see app/functions/scripts/bootstrap-admin.js),
// same pattern as the M1 data migration script.
export const setUserRole = onCall<SetUserRoleRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  if (request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin puede asignar roles.')
  }

  const { uid, role } = request.data
  if (!uid || !role || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `role debe ser uno de: ${VALID_ROLES.join(', ')}`)
  }

  const existingClaims = (await auth.getUser(uid)).customClaims ?? {}
  await auth.setCustomUserClaims(uid, { ...existingClaims, role })
  await db.collection('users').doc(uid).set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

  return { ok: true }
})

// --- M6: seller CRM (trackable links + lead capture) ---

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o/1/l/i — avoids visual ambiguity in a shared link
function randomCode(length = 7): string {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}

interface CreateTrackableLinkRequest {
  propertyId?: string | null
  propertyType?: 'rental' | 'sale' | null
  sellerUid?: string // only honored when the caller is admin creating on a seller's behalf
}

// Callable, seller or admin. Document ID is the code itself (see
// firestore.rules — this is what lets the public /l/:code redirect page
// do a single-doc `get` without needing list access to the collection).
export const createTrackableLink = onCall<CreateTrackableLinkRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  const callerRole = request.auth.token.role
  if (callerRole !== 'seller' && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo sellers o admins pueden generar links.')
  }

  const sellerUid = callerRole === 'admin' && request.data.sellerUid ? request.data.sellerUid : request.auth.uid
  const propertyId = request.data.propertyId || null
  const propertyType = propertyId ? request.data.propertyType || null : null

  let code = ''
  let attempts = 0
  // Collision retry — at 7 chars from a 32-symbol alphabet this is
  // astronomically unlikely to ever loop more than once, but a fixed
  // Firestore doc ID needs the check regardless of how unlikely.
  while (attempts < 5) {
    code = randomCode()
    const existing = await db.collection('links').doc(code).get()
    if (!existing.exists) break
    attempts++
  }
  if (attempts === 5) {
    throw new HttpsError('resource-exhausted', 'No se pudo generar un código único, intentá de nuevo.')
  }

  await db.collection('links').doc(code).set({
    sellerUid,
    propertyId,
    propertyType,
    clicks: 0,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  })

  return { code, url: `https://www.bairesrental.com.ar/l/${code}` }
})

interface SubmitLeadRequest {
  code?: string | null
  propertyId?: string | null
  propertyType?: 'rental' | 'sale' | null
  name: string
  phone: string
  message?: string
}

// Callable, PUBLIC — anonymous visitors submit leads through this (that's
// the point). Resolves `code` → sellerUid via the links collection so the
// lead lands attributed to the right seller; the Admin SDK access here is
// exactly why this can't just be a direct client Firestore write (leads
// aren't publicly writable — see firestore.rules).
export const submitLead = onCall<SubmitLeadRequest>(async (request) => {
  const { code, propertyId, propertyType, name, phone, message } = request.data
  if (!name?.trim() || !phone?.trim()) {
    throw new HttpsError('invalid-argument', 'Nombre y teléfono son obligatorios.')
  }

  let sellerUid: string | null = null
  let linkId: string | null = null
  if (code) {
    const linkDoc = await db.collection('links').doc(code).get()
    if (linkDoc.exists && linkDoc.data()?.active !== false) {
      sellerUid = linkDoc.data()?.sellerUid ?? null
      linkId = linkDoc.id
      await linkDoc.ref.update({ clicks: FieldValue.increment(1) })
    }
  }

  const leadRef = await db.collection('leads').add({
    sellerUid,
    linkId,
    propertyId: propertyId || null,
    propertyType: propertyType || null,
    name: name.trim(),
    phone: phone.trim(),
    message: message?.trim() || null,
    source: code ? 'link' : 'direct-whatsapp',
    status: 'new',
    notes: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { ok: true, leadId: leadRef.id }
})

interface UploadListingImageRequest {
  collectionName: 'rentals' | 'sales'
  propertyId: string
  fileName: string
  contentType: string
  dataBase64: string
}

// Callable, admin/seller. Exists specifically to check listing ownership
// (sellerUid) server-side via the Admin SDK before writing to Storage,
// because that same check can't be done in storage.rules for this
// project — see the comment at the top of storage.rules for the full
// story (a `firestore.get()` cross-service rule was confirmed non-
// functional here, isolated with a hardcoded-true test case, even after
// granting the documented IAM roles for it). Admins could also upload
// directly per storage.rules, but routing everyone through one function
// keeps the client code path uniform.
export const uploadListingImage = onCall<UploadListingImageRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  const { collectionName, propertyId, fileName, contentType, dataBase64 } = request.data
  if (collectionName !== 'rentals' && collectionName !== 'sales') {
    throw new HttpsError('invalid-argument', 'collectionName debe ser "rentals" o "sales".')
  }

  const callerRole = request.auth.token.role
  if (callerRole !== 'admin') {
    if (callerRole !== 'seller') {
      throw new HttpsError('permission-denied', 'Solo admins o sellers pueden subir imágenes.')
    }
    const propertyDoc = await db.collection(collectionName).doc(propertyId).get()
    if (!propertyDoc.exists || propertyDoc.data()?.sellerUid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Esta propiedad no te pertenece.')
    }
  }

  const buffer = Buffer.from(dataBase64, 'base64')
  const path = `${collectionName}/${propertyId}/${fileName}`
  const bucket = getStorage().bucket()
  await bucket.file(path).save(buffer, { contentType, metadata: { cacheControl: 'public, max-age=31536000' } })

  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media` }
})

// --- M8: old→new URL redirect map ---
//
// The old static site's detail pages take the listing id as a query
// string param (?id=<slug>), which Firebase Hosting's `redirects`/
// `rewrites` `source` matching cannot see at all (a real platform
// limitation, not a glob-pattern problem — confirmed against Firebase's
// hosting config docs before writing this). Plain page renames with no
// query param (index.html, departamentos.html, ventas.html, tickets.html,
// catalogo-vendedores.html, ficha-vendedor.html) are handled entirely by
// `firebase.json`'s new `redirects` array instead — no function needed
// there, since the destination doesn't depend on the query string (this
// also applies to ficha-vendedor.html?id=..., which redirects to the
// fixed /app/login destination regardless of id). Only the two pages
// below have a destination that actually depends on the id, so only
// these two get a Hosting rewrite to a Cloud Function
// (`firebase.json`'s `rewrites` array) that reads `req.query.id` and
// 301s to the real new URL. No need to verify the id actually exists in
// Firestore first — a redirect to a nonexistent listing 404s the same way
// a stale link does today.
const OLD_SITE_ORIGIN = 'https://www.bairesrental.com.ar'

export const legacyDetailRedirect = onRequest((req, res) => {
  const id = req.query.id
  if (typeof id !== 'string' || !id) {
    res.redirect(301, `${OLD_SITE_ORIGIN}/departamentos`)
    return
  }
  res.redirect(301, `${OLD_SITE_ORIGIN}/departamentos/${encodeURIComponent(id)}`)
})

export const legacyVentaDetailRedirect = onRequest((req, res) => {
  const id = req.query.id
  if (typeof id !== 'string' || !id) {
    res.redirect(301, `${OLD_SITE_ORIGIN}/ventas`)
    return
  }
  res.redirect(301, `${OLD_SITE_ORIGIN}/ventas/${encodeURIComponent(id)}`)
})

// M7 tried moving the home page contact form's Web3Forms call server-side
// (to get the access key out of client-visible markup) as submitContactForm,
// a callable using a defineSecret('WEB3FORMS_ACCESS_KEY') secret. Verified
// against the real API that Web3Forms' free plan flatly rejects
// server-to-server calls ("Use our API in client side ... Pro plan is
// required" — confirmed with a direct curl to api.web3forms.com/submit,
// not just from this function). Web3Forms' actual security model is a
// client-side key restricted by domain in their dashboard, not secrecy of
// the key, so there was nothing to fix — reverted; the contact form
// (src/pages/Home.vue) calls Web3Forms directly from the browser again,
// same as the original static site. See app/CHANGELOG.md M7 for the full
// story. The WEB3FORMS_ACCESS_KEY secret that was created in Secret
// Manager during that attempt is unused now; left in place rather than
// deleted since removing secrets needs the same manual step as creating
// them and it costs nothing to leave it.
