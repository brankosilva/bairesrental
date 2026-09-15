// M4: onUserCreate (profile bootstrap) + setUserRole (admin-only role
// assignment). M6 adds createTrackableLink + submitLead (the seller CRM
// feature). M7 adds submitContactForm (the home page contact form, moved
// server-side to stop exposing the Web3Forms key client-side, later
// reverted — see the note at the bottom of this file). M8 adds the
// legacy URL redirect functions (legacyDetailRedirect,
// legacyVentaDetailRedirect) — see docs/historial-app-vue.md's M8 entry. M8 also
// added a rebuild-on-data-change automation subsystem
// (onRentalWrite/onSaleWrite + scheduledRebuildCheck), since removed by
// N5 of the Nuxt SSR migration (see nuxt-app/CHANGELOG.md and
// docs/historial-app-vue.md's N5 entry) — real per-request SSR reads Firestore
// live on every request, so there's nothing left to "rebuild." N8
// completes the admin Usuarios screen's CRUD: updateUser + deleteUser
// join inviteUser here, and onUserCreate stops clobbering the role an
// invite just assigned (see below).
import * as functionsV1 from 'firebase-functions/v1'
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

initializeApp()
const db = getFirestore()
const auth = getAuth()

// Closest Cloud Functions v2 region to Buenos Aires, matching the
// Firestore database's region (see docs/historial-app-vue.md M1). v1 Auth triggers
// (onUserCreate, below) don't support region selection and stay on the
// gen1 default.
setGlobalOptions({ region: 'southamerica-east1' })

// Runs on every Auth account creation, including the one inviteUser does
// itself. It used to write the profile with a plain (non-merge) `set`
// including `role: null`, which races inviteUser: the trigger fires
// asynchronously a beat *after* createUser() returns, so it could land
// after inviteUser had already written the assigned role and silently
// reset it to null — the invited user would then log in to the "sin rol"
// dashboard. Reading first inside a transaction makes the trigger
// idempotent: it fills in what's missing and never overwrites a role (or
// a createdAt) that is already there.
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const ref = db.collection('users').doc(user.uid)
  await db.runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data() ?? {}
    tx.set(
      ref,
      {
        email: user.email ?? existing.email ?? null,
        displayName: user.displayName ?? existing.displayName ?? null,
        phone: user.phoneNumber ?? existing.phone ?? null,
        role: existing.role ?? null,
        createdAt: existing.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })
})

const VALID_ROLES = ['admin', 'seller', 'owner'] as const
type Role = (typeof VALID_ROLES)[number]

// The `signed in` + `is admin` pair every admin-only callable below opens
// with. Takes the action-specific message so the user-facing wording stays
// per-function, exactly as it was when each one inlined these two checks.
function requireAdmin<T>(request: CallableRequest<T>, denied: string): void {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  if (request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', denied)
  }
}

// Guard for the three ways an admin can lock everyone out of the app:
// demoting, suspending or deleting the last remaining admin. Recovering
// from that needs service-account credentials and a manual re-run of
// functions/scripts/bootstrap-admin.js, so it's worth refusing up front.
// Counts against the Firestore mirror rather than listing Auth users —
// inviteUser/updateUser/setUserRole all keep the two in sync, and a full
// listUsers() pagination scan to answer "is there another admin" would be
// disproportionate here.
async function assertNotLastAdmin(uid: string, action: string): Promise<void> {
  const target = await db.collection('users').doc(uid).get()
  if (target.data()?.role !== 'admin') return
  const admins = await db.collection('users').where('role', '==', 'admin').count().get()
  if (admins.data().count <= 1) {
    throw new HttpsError('failed-precondition', `No podés ${action} al único admin que queda.`)
  }
}

interface SetUserRoleRequest {
  uid?: string
  role?: Role
}

// Callable, admin-only. The very first admin can't be created through this
// function (nothing is admin yet) — that one-time bootstrap is done
// directly via the Admin SDK (see functions/scripts/bootstrap-admin.js),
// same pattern as the M1 data migration script.
//
// N8 note: the admin Usuarios screen no longer calls this — updateUser
// (below) does the same role write plus the rest of the profile, and adds
// the last-admin guard this one lacks. Kept deployed and unchanged
// because it's a stable endpoint documented since M4; delete it only in a
// deliberate `firebase deploy` that's expecting to remove a function.
export const setUserRole = onCall<SetUserRoleRequest>(async (request) => {
  requireAdmin(request, 'Solo un admin puede asignar roles.')

  const { uid, role } = request.data
  if (!uid || !role || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `role debe ser uno de: ${VALID_ROLES.join(', ')}`)
  }

  const existingClaims = (await auth.getUser(uid)).customClaims ?? {}
  await auth.setCustomUserClaims(uid, { ...existingClaims, role })
  await db.collection('users').doc(uid).set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

  return { ok: true }
})

interface InviteUserRequest {
  email?: string
  role?: Role
  displayName?: string
  phone?: string
}

// Callable, admin-only. Lets an admin provision a new seller/owner/admin
// account entirely from the app — no more hand-creating the Firebase Auth
// user in the console (see bootstrap-admin.js's comment, now outdated for
// every case but the very first admin). Creates the Auth user if it
// doesn't exist yet, assigns the role the same way setUserRole does, and
// returns a password-reset link (via the Admin SDK, so no email delivery
// dependency) for the admin to copy and send however they already reach
// this person — WhatsApp, in this business's case, not email.
export const inviteUser = onCall<InviteUserRequest>(async (request) => {
  requireAdmin(request, 'Solo un admin puede invitar usuarios.')

  const email = request.data.email?.trim()
  const role = request.data.role
  if (!email || !role || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `role debe ser uno de: ${VALID_ROLES.join(', ')}`)
  }
  const displayName = request.data.displayName?.trim() || null
  const phone = request.data.phone?.trim() || null

  let user
  try {
    user = await auth.getUserByEmail(email)
    if (displayName) user = await auth.updateUser(user.uid, { displayName })
  } catch {
    user = await auth.createUser(displayName ? { email, displayName } : { email })
  }

  const existingClaims = user.customClaims ?? {}
  await auth.setCustomUserClaims(user.uid, { ...existingClaims, role })
  await db.collection('users').doc(user.uid).set(
    {
      email: user.email ?? email,
      role,
      // Only overwrite the profile fields the admin actually filled in —
      // re-inviting an existing user with the name box left empty must not
      // wipe the name they already have.
      ...(displayName ? { displayName } : {}),
      ...(phone ? { phone } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  const link = await auth.generatePasswordResetLink(email)

  return { uid: user.uid, link }
})

interface UpdateUserRequest {
  uid?: string
  role?: Role | null
  displayName?: string | null
  phone?: string | null
  disabled?: boolean
}

// Callable, admin-only — the U of the Usuarios CRUD. Every field is
// optional and only the ones actually present in the payload are touched,
// so the same callable serves the row's inline edit (name/phone/role) and
// the suspend/reactivate toggle without either clobbering the other.
//
// `displayName` is mirrored into Firebase Auth (free-form field, nothing
// validates it); `phone` deliberately is NOT written to Auth's
// phoneNumber, which must be a globally-unique E.164 number tied to
// phone sign-in — a perfectly good contact number like "11 7373-5757"
// would fail the whole update there. Here it's just a profile field, the
// same way `leads` stores one.
export const updateUser = onCall<UpdateUserRequest>(async (request) => {
  requireAdmin(request, 'Solo un admin puede editar usuarios.')

  const { uid, role, displayName, phone, disabled } = request.data
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Falta el uid del usuario.')
  }
  if (role !== undefined && role !== null && !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `role debe ser uno de: ${VALID_ROLES.join(', ')}`)
  }

  const profile: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }

  if (role !== undefined) {
    if (role !== 'admin') await assertNotLastAdmin(uid, 'sacarle el rol de admin')
    const existingClaims = (await auth.getUser(uid)).customClaims ?? {}
    await auth.setCustomUserClaims(uid, { ...existingClaims, role })
    profile.role = role
  }

  if (displayName !== undefined) {
    const name = displayName?.trim() || null
    await auth.updateUser(uid, { displayName: name })
    profile.displayName = name
  }

  if (phone !== undefined) {
    profile.phone = phone?.trim() || null
  }

  if (disabled !== undefined) {
    if (disabled) await assertNotLastAdmin(uid, 'suspender')
    await auth.updateUser(uid, { disabled })
    profile.disabled = disabled
  }

  await db.collection('users').doc(uid).set(profile, { merge: true })

  return { ok: true }
})

interface DeleteUserRequest {
  uid?: string
}

// Callable, admin-only — the D of the Usuarios CRUD. Deletes the Firebase
// Auth account *and* the Firestore profile; the screen also offers
// updateUser({ disabled: true }) as the reversible alternative, which is
// the right choice for someone who may come back.
//
// Refuses rather than cascades when the user still has listings: a rental
// or sale whose sellerUid/ownerUid points at a deleted account keeps
// showing on the public catalog with an attribution that resolves to
// nobody, and reassigning a property is a business decision, not a side
// effect of removing a login.
export const deleteUser = onCall<DeleteUserRequest>(async (request) => {
  requireAdmin(request, 'Solo un admin puede eliminar usuarios.')

  const { uid } = request.data
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Falta el uid del usuario.')
  }
  if (uid === request.auth!.uid) {
    throw new HttpsError('failed-precondition', 'No podés eliminar tu propio usuario.')
  }
  await assertNotLastAdmin(uid, 'eliminar')

  const [rentalsAsSeller, salesAsSeller, rentalsAsOwner, salesAsOwner] = await Promise.all([
    db.collection('rentals').where('sellerUid', '==', uid).count().get(),
    db.collection('sales').where('sellerUid', '==', uid).count().get(),
    db.collection('rentals').where('ownerUid', '==', uid).count().get(),
    db.collection('sales').where('ownerUid', '==', uid).count().get(),
  ])
  const asSeller = rentalsAsSeller.data().count + salesAsSeller.data().count
  const asOwner = rentalsAsOwner.data().count + salesAsOwner.data().count
  if (asSeller + asOwner > 0) {
    const detalle = [
      ...(asSeller ? [`${asSeller} como vendedor`] : []),
      ...(asOwner ? [`${asOwner} como propietario`] : []),
    ].join(' y ')
    throw new HttpsError(
      'failed-precondition',
      `No se puede eliminar: todavía tiene propiedades asignadas (${detalle}). Reasignalas o eliminalas primero, o suspendé el usuario en lugar de borrarlo.`,
    )
  }

  // Trackable links are deactivated, not deleted: `leads` reference them
  // by linkId, so removing them outright would break the attribution
  // history of leads this seller already brought in. Deactivated means a
  // /l/:code that outlives its seller stops capturing new ones.
  const links = await db.collection('links').where('sellerUid', '==', uid).get()
  if (!links.empty) {
    const batch = db.batch()
    links.docs.forEach((doc) => batch.update(doc.ref, { active: false }))
    await batch.commit()
  }

  // Auth first, then the profile: if the second step failed, what's left
  // is an orphan Firestore doc visible in this very screen, which an admin
  // can retry away. The reverse order could leave an account that can
  // still sign in with no profile row to find it by.
  try {
    await auth.deleteUser(uid)
  } catch (e) {
    // A profile can outlive its Auth user (e.g. the account was removed
    // from the Firebase console); that shouldn't block cleaning up the
    // leftover doc here.
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e
  }
  await db.collection('users').doc(uid).delete()

  return { ok: true, linksDeactivated: links.size }
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
// same as the original static site. See docs/historial-app-vue.md M7 for the full
// story. The WEB3FORMS_ACCESS_KEY secret that was created in Secret
// Manager during that attempt is unused now; left in place rather than
// deleted since removing secrets needs the same manual step as creating
// them and it costs nothing to leave it.
