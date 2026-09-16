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
import { esUrlDeFicha, fetchFicha, fichaToRental, fichaToSale, proximoIdAlq, proximoIdVen } from './ficha'

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
// Deja lista la ficha pública de un vendedor apenas se le asigna el rol.
//
// Sin esto, el primer link que comparte un vendedor recién creado
// renderiza una página sin nombre ni foto — el peor momento posible para
// que se vea vacía. Con `merge: true` y sólo los campos mínimos, volver a
// invitar o editar a alguien nunca pisa lo que ya cargó de su ficha.
async function ensureSellerProfile(uid: string, displayName?: string | null): Promise<void> {
  const ref = db.collection('sellerProfiles').doc(uid)
  const existing = await ref.get()
  if (existing.exists) {
    // Ya tiene ficha: como mucho, completar el nombre si quedó vacío.
    if (!existing.data()?.displayName && displayName) {
      await ref.set({ displayName, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    return
  }
  await ref.set(
    {
      uid,
      displayName: displayName || 'Asesor inmobiliario',
      title: null,
      photoUrl: null,
      whatsapp: null,
      bio: null,
      instagram: null,
      logoUrl: null,
      accentColor: null,
      slug: null,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

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
  if (role === 'seller') {
    const name = displayName ?? user.displayName ?? null
    await ensureSellerProfile(user.uid, name)
    // El link que va a compartir queda hecho acá, con la cuenta. Antes el
    // vendedor entraba a "Mis links" y tenía que generarse uno a mano para
    // poder mostrar algo, eligiendo una publicación y poniéndole el nombre
    // de un cliente: tres decisiones antes de tener una URL que mandar.
    await ensurePrimaryLink(user.uid, name, user.email ?? email)
  }
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

  // `role === 'seller'` a secas sólo cubría el alta del rol en ESTA llamada,
  // así que corregirle el nombre a un vendedor que ya lo era no llegaba ni a
  // la ficha ni al link. El rol efectivo se lee del documento recién
  // escrito, que ya refleja el cambio si lo hubo.
  const effectiveRole =
    role !== undefined ? role : ((await db.collection('users').doc(uid).get()).data()?.role ?? null)
  if (effectiveRole === 'seller') {
    const authUser = await auth.getUser(uid)
    const name = displayName !== undefined ? displayName?.trim() || null : authUser.displayName ?? null
    await ensureSellerProfile(uid, name)
    await ensurePrimaryLink(uid, name, authUser.email ?? null)
  }

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
  // La ficha pública sí se borra (a diferencia de los links, que se
  // desactivan): es una página con foto y nombre de alguien que ya no
  // trabaja acá, y nada la referencia por id.
  await db.collection('sellerProfiles').doc(uid).delete()

  return { ok: true, linksDeactivated: links.size }
})

// --- M6: seller CRM (trackable links + lead capture) ---

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o/1/l/i — avoids visual ambiguity in a shared link
function randomCode(length = 7): string {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}

const VALID_CHANNELS = ['whatsapp', 'instagram', 'email', 'sms', 'facebook', 'presencial', 'otro'] as const
type LinkChannel = (typeof VALID_CHANNELS)[number]

// --- El link personal del vendedor ---
//
// Cada cuenta de vendedor tiene UN link permanente, creado junto con la
// cuenta, cuyo código es el slug de su nombre: /l/juan-perez. Apunta a todo
// el catálogo y es el que la persona pone en la bio de Instagram, en su
// firma o en el estado de WhatsApp — no se genera, no se elige, no se
// desactiva. Los links de createTrackableLink siguen existiendo para lo
// otro: seguir una publicación puntual o una campaña con su propio nombre.

function slugifyName(value: string, maxLength = 40): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca los acentos: "Martín" → "martin"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= maxLength) return slug
  // Corta en el guión anterior al límite: "monoambiente-en-parque-chacabuco"
  // recortado a la bruta queda "monoambiente-en-parque-chac", que se lee como
  // un error de tipeo. Mejor una palabra menos.
  const cut = slug.slice(0, maxLength)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '')
}

// El código tiene que entrar en el patrón que matchea el middleware que
// cuenta las aperturas (server/middleware/01.link-open.ts): de 2 a 40
// caracteres de [a-z0-9-]. Si el nombre no da para eso —una sola letra, o
// puros símbolos— se cae al mail y después al uid, porque quedarse sin link
// es peor que quedarse sin un link lindo.
function primaryLinkBase(displayName?: string | null, email?: string | null, uid = ''): string {
  for (const candidate of [displayName || '', (email || '').split('@')[0] || '']) {
    const slug = slugifyName(candidate)
    if (slug.length >= 2) return slug
  }
  return `vendedor-${uid.slice(0, 6).toLowerCase()}`
}

async function freeLinkCode(base: string): Promise<string> {
  // juan-perez, juan-perez-2, juan-perez-3… Dos vendedores homónimos son
  // raros pero posibles, y el ID de un documento no admite duplicados.
  for (let i = 1; i <= 20; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`
    if (!(await db.collection('links').doc(candidate).get()).exists) return candidate
  }
  return `${base}-${randomCode(4)}`
}

/**
 * Deja listo el link personal del vendedor y devuelve su código.
 *
 * Idempotente: se la puede llamar en cada invitación y en cada edición del
 * usuario sin que duplique nada. Son dos igualdades, así que la búsqueda no
 * necesita índice compuesto (Firestore la resuelve con zigzag merge join).
 */
async function ensurePrimaryLink(
  uid: string,
  displayName?: string | null,
  email?: string | null,
): Promise<string> {
  const name = displayName?.trim() || null
  const base = primaryLinkBase(name, email, uid)
  const existing = await db
    .collection('links')
    .where('sellerUid', '==', uid)
    .where('primary', '==', true)
    .limit(1)
    .get()

  if (!existing.empty) {
    const doc = existing.docs[0]!
    const data = doc.data()
    const label = name || (data.label as string) || 'Todo el catálogo'

    // El código se renombra SÓLO mientras el link no se haya usado nunca. A
    // partir de la primera apertura —incluida la vista previa de WhatsApp,
    // que cuenta en botOpens— hay una URL dando vueltas en el chat de
    // alguien, y cambiarla la rompe. Esto está para el caso real: invitar
    // sin nombre (el código sale del mail) y cargarlo un minuto después.
    const untouched = !data.opens && !data.botOpens && !data.whatsappClicks && !data.leads && !data.clicks
    const baseFree = doc.id !== base && !(await db.collection('links').doc(base).get()).exists
    if (untouched && baseFree) {
      // Y sólo al slug exacto, nunca a un "juan-perez-2" derivado: si el
      // código bueno está ocupado, se queda con el que tiene. Renombrar a un
      // sufijo distinto en cada edición sería un link que se mueve solo.
      await db
        .collection('links')
        .doc(base)
        .set({ ...data, label, labelLower: label.toLowerCase(), updatedAt: FieldValue.serverTimestamp() })
      await doc.ref.delete()
      return base
    }

    if (data.label !== label) {
      await doc.ref.set(
        { label, labelLower: label.toLowerCase(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
    return doc.id
  }

  const code = await freeLinkCode(base)
  const label = name || 'Todo el catálogo'
  await db.collection('links').doc(code).set({
    sellerUid: uid,
    target: 'catalog',
    propertyId: null,
    propertyType: null,
    propertyTitulo: null,
    label,
    labelLower: label.toLowerCase(),
    // Sin canal: éste no se manda por ningún lado en particular.
    channel: null,
    note: null,
    outcome: 'pending',
    primary: true,
    active: true,
    opens: 0,
    botOpens: 0,
    whatsappClicks: 0,
    leads: 0,
    clicks: 0,
    firstOpenAt: null,
    lastOpenAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return code
}

/**
 * El código del link personal del vendedor, que es el prefijo de todos los
 * demás. Lo crea si la cuenta es anterior a que fuera automático, así que
 * siempre devuelve algo.
 */
async function primaryLinkCodeFor(uid: string): Promise<string> {
  const snap = await db
    .collection('links')
    .where('sellerUid', '==', uid)
    .where('primary', '==', true)
    .limit(1)
    .get()
  if (!snap.empty) return snap.docs[0]!.id
  const user = (await db.collection('users').doc(uid).get()).data() ?? {}
  return ensurePrimaryLink(uid, (user.displayName as string | null) ?? null, (user.email as string | null) ?? null)
}

interface EnsureSellerLinkRequest {
  uid?: string
}

// Callable, vendedor (para sí mismo) o admin (para cualquier vendedor).
//
// Es el remiendo de las cuentas que ya existían antes de que el link
// personal fuera automático: /app/seller/links la llama sólo cuando no
// encuentra el link personal en la lista que acaba de leer, así que en una
// cuenta creada después de este cambio no se llama nunca. Evita tener que
// correr un backfill a mano contra producción.
export const ensureSellerLink = onCall<EnsureSellerLinkRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  const callerRole = request.auth.token.role
  if (callerRole !== 'seller' && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un vendedor tiene link personal.')
  }
  const uid = callerRole === 'admin' && request.data?.uid ? request.data.uid : request.auth.uid

  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists || userSnap.data()?.role !== 'seller') {
    throw new HttpsError('invalid-argument', 'El usuario no existe o no tiene rol de vendedor.')
  }
  const data = userSnap.data()!
  const code = await ensurePrimaryLink(
    uid,
    (data.displayName as string | null) ?? null,
    (data.email as string | null) ?? null,
  )
  return { code }
})

interface CreateTrackableLinkRequest {
  target?: 'property' | 'catalog'
  propertyId?: string | null
  propertyType?: 'rental' | 'sale' | null
  label?: string
  channel?: LinkChannel
  note?: string | null
  sellerUid?: string // only honored when the caller is admin creating on a seller's behalf
}

// Callable, seller or admin. Document ID is the code itself.
//
// Es el link EXTRA: el personal ya lo tiene cada vendedor desde que se crea
// la cuenta (ensurePrimaryLink, arriba). Éste sirve para seguir aparte una
// publicación puntual o una campaña, con el nombre que el vendedor le ponga.
//
// Esta función no validaba NADA de lo que le mandaban: aceptaba cualquier
// propertyId, existente o no, y lo escribía tal cual — un link a una
// publicación inventada es una página rota que el vendedor descubre recién
// cuando el cliente no le contesta. Eso se sigue validando server-side.
//
// También dejó de devolver `url`. Antes armaba
// `https://www.bairesrental.com.ar/l/${code}` acá adentro, que es el
// dominio del sitio estático viejo — sin ruta /l/, o sea que todos los
// links generados hasta entonces estaban rotos. La URL ahora la arma la UI
// en useLinkUrl() a partir de `site.url` (ver nuxt.config.ts), un solo lugar.
// Sacarlo de acá es seguro: la pantalla del vendedor descartaba el valor de
// retorno.
export const createTrackableLink = onCall<CreateTrackableLinkRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  const callerRole = request.auth.token.role
  if (callerRole !== 'seller' && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo sellers o admins pueden generar links.')
  }

  const sellerUid = callerRole === 'admin' && request.data.sellerUid ? request.data.sellerUid : request.auth.uid

  // Un admin creando en nombre de alguien: que ese alguien exista y sea
  // efectivamente un vendedor, o el link queda huérfano y sus leads se
  // atribuyen a un uid que no resuelve a nadie.
  if (sellerUid !== request.auth.uid) {
    const target = await db.collection('users').doc(sellerUid).get()
    if (!target.exists || target.data()?.role !== 'seller') {
      throw new HttpsError('invalid-argument', 'El vendedor indicado no existe o no tiene rol de vendedor.')
    }
  }

  // El nombre es del LINK, no de un destinatario: "Todos los monoambientes",
  // "Campaña de Instagram". Y es opcional — si no lo ponen, sale el título de
  // la publicación, que es lo que la persona habría escrito igual. Antes era
  // obligatorio y era el nombre del cliente: un dato que había que inventar
  // para poder generar un link y que partía las métricas de una misma
  // publicación en una fila por cliente.
  const requestedLabel = request.data.label?.trim() || ''
  if (requestedLabel.length > 80) {
    throw new HttpsError('invalid-argument', 'El nombre del link es demasiado largo (máximo 80).')
  }

  const channel: LinkChannel = request.data.channel ?? 'whatsapp'
  if (!VALID_CHANNELS.includes(channel)) {
    throw new HttpsError('invalid-argument', `channel debe ser uno de: ${VALID_CHANNELS.join(', ')}`)
  }

  const note = request.data.note?.trim() || null
  if (note && note.length > 280) {
    throw new HttpsError('invalid-argument', 'La nota es demasiado larga (máximo 280).')
  }

  const target = request.data.target ?? (request.data.propertyId ? 'property' : 'catalog')
  let propertyId: string | null = null
  let propertyType: 'rental' | 'sale' | null = null
  let propertyTitulo: string | null = null

  if (target === 'property') {
    propertyId = request.data.propertyId?.trim() || null
    propertyType = request.data.propertyType ?? null
    if (!propertyId) {
      throw new HttpsError('invalid-argument', 'Elegí una publicación.')
    }
    if (propertyType !== 'rental' && propertyType !== 'sale') {
      throw new HttpsError('invalid-argument', 'propertyType debe ser "rental" o "sale".')
    }

    const propertySnap = await db
      .collection(propertyType === 'rental' ? 'rentals' : 'sales')
      .doc(propertyId)
      .get()
    if (!propertySnap.exists) {
      throw new HttpsError('not-found', 'Esa publicación no existe.')
    }
    // Acá había un chequeo de pertenencia: un vendedor podía generar links
    // del catálogo de BairesRental y de lo suyo, pero no de la exclusiva de
    // otro vendedor. El equipo pasó a compartir un catálogo solo, así que
    // toda publicación que exista es compartible.
    //
    // Es la misma regla que `isShareableBySeller()` en
    // nuxt-app/app/utils/sellerScope.ts. Se repite acá porque functions/ es un
    // paquete TypeScript aparte y no comparte módulos con la app: si cambia
    // una, cambiar la otra.
    propertyTitulo = propertySnap.data()?.titulo ?? null
  }

  const label = requestedLabel || propertyTitulo || 'Todo el catálogo'
  const labelLower = label.toLowerCase()

  // Idempotencia: generar dos veces el mismo link con el mismo nombre sobre
  // la misma publicación devuelve el que ya existe en vez de duplicarlo
  // (tocar "Generar" dos veces es lo más fácil del mundo, y dos links iguales
  // parten las métricas en dos).
  //
  // Son todas igualdades, así que Firestore lo resuelve con zigzag merge
  // join sobre los índices de campo único — no hace falta índice compuesto.
  const duplicate = await db
    .collection('links')
    .where('sellerUid', '==', sellerUid)
    .where('propertyId', '==', propertyId)
    .where('labelLower', '==', labelLower)
    .where('active', '==', true)
    .limit(1)
    .get()
  if (!duplicate.empty) {
    return { code: duplicate.docs[0].id, existing: true }
  }

  // El código cuelga del link personal: juan-perez-monoambientes, no ab3f9k.
  // Lo que el cliente ve en el chat antes de tocar dice de quién es y de qué
  // se trata, y el vendedor puede dictarlo por teléfono. El sufijo sale del
  // nombre del link —o del título de la publicación, que es el nombre por
  // defecto— recortado a 30 caracteres para que el total entre en el patrón
  // que matchea server/middleware/01.link-open.ts.
  //
  // Si el nombre no da ningún slug (un emoji, puros signos), cae en los 7
  // caracteres al azar de siempre: un link feo es mejor que un error.
  const suffix = slugifyName(label, 30) || randomCode()
  const code = await freeLinkCode(`${await primaryLinkCodeFor(sellerUid)}-${suffix}`)

  await db.collection('links').doc(code).set({
    sellerUid,
    target,
    propertyId,
    propertyType,
    propertyTitulo,
    label,
    labelLower,
    channel,
    note,
    outcome: 'pending',
    active: true,
    opens: 0,
    botOpens: 0,
    whatsappClicks: 0,
    leads: 0,
    clicks: 0,
    firstOpenAt: null,
    lastOpenAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { code, existing: false }
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
      // `leads` es el nombre real de lo que este contador siempre midió.
      // `clicks` se mantiene una release más porque los links creados
      // antes de esta milestone sólo tienen ese campo — las pantallas
      // nuevas leen `leads`. Ver app/types/link.ts.
      await linkDoc.ref.update({
        leads: FieldValue.increment(1),
        clicks: FieldValue.increment(1),
      })
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
  const { collectionName, propertyId, fileName, contentType, dataBase64 } = request.data
  await assertCanWriteListing(request, collectionName, propertyId)

  return saveListingImage(collectionName, propertyId, fileName, contentType, Buffer.from(dataBase64, 'base64'))
})

// El mismo chequeo para las dos formas de cargar una foto (subirla o
// importarla desde un link): el rol sale del claim y, si es vendedor, la
// propiedad tiene que ser suya.
async function assertCanWriteListing(request: CallableRequest, collectionName: string, propertyId: string) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  if (collectionName !== 'rentals' && collectionName !== 'sales') {
    throw new HttpsError('invalid-argument', 'collectionName debe ser "rentals" o "sales".')
  }

  const callerRole = request.auth.token.role
  if (callerRole === 'admin') return
  if (callerRole !== 'seller') {
    throw new HttpsError('permission-denied', 'Solo admins o sellers pueden subir imágenes.')
  }
  const propertyDoc = await db.collection(collectionName).doc(propertyId).get()
  if (!propertyDoc.exists || propertyDoc.data()?.sellerUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Esta propiedad no te pertenece.')
  }
}

async function saveListingImage(
  collectionName: string,
  propertyId: string,
  fileName: string,
  contentType: string,
  buffer: Buffer,
) {
  const path = `${collectionName}/${propertyId}/${fileName}`
  const bucket = getStorage().bucket()
  await bucket.file(path).save(buffer, { contentType, metadata: { cacheControl: 'public, max-age=31536000' } })

  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media` }
}

interface ImportListingImageRequest {
  collectionName: 'rentals' | 'sales'
  propertyId: string
  /** Sin extensión: la pone el server según el content-type que devuelva el origen. */
  fileName: string
  sourceUrl: string
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

// Callable, admin/seller. Descarga la foto desde un link externo (Tokko,
// Zonaprop, Airbnb…) y la guarda en nuestro Storage, así el catálogo no
// queda colgado de un CDN ajeno que puede dar de baja la publicación. Va
// por el server y no por el navegador porque esos CDN no mandan CORS.
export const importListingImage = onCall<ImportListingImageRequest>(async (request) => {
  const { collectionName, propertyId, fileName, sourceUrl } = request.data
  await assertCanWriteListing(request, collectionName, propertyId)

  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    throw new HttpsError('invalid-argument', 'El link no es una URL válida.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpsError('invalid-argument', 'El link tiene que empezar con http o https.')
  }

  // Sin User-Agent, varios portales devuelven 403 a la descarga directa.
  const res = await fetch(parsed.toString(), {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; BairesRentalBot/1.0)' },
  })
  if (!res.ok) {
    throw new HttpsError('invalid-argument', `No se pudo descargar la imagen (HTTP ${res.status}).`)
  }
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const ext = EXT_BY_TYPE[contentType]
  if (!ext) {
    throw new HttpsError('invalid-argument', 'Ese link no devuelve una imagen (jpg, png, webp, gif o avif).')
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength > 15 * 1024 * 1024) {
    throw new HttpsError('invalid-argument', 'La imagen pesa más de 15 MB.')
  }

  return saveListingImage(collectionName, propertyId, `${fileName}.${ext}`, contentType, buffer)
})

interface ImportFromFichaRequest {
  url: string
  /** A qué catálogo va. Por defecto `rentals`, que fue el primero en tenerlo. */
  collectionName?: 'rentals' | 'sales'
}

// Callable, admin/seller. Lee una ficha pública de ficha.info (el "link para
// colegas" de Tokko) y devuelve los campos ya mapeados para el formulario de
// alta, más el próximo id libre de la serie (`alq-NN` o `ven-NN`). No escribe
// nada: el alta la sigue haciendo el formulario por el camino de siempre.
//
// La misma ficha se puede leer como alquiler o como venta: Tokko publica las
// dos operaciones en el mismo documento, así que lo que decide qué campos se
// miran (el precio de venta y los metros, o el precio por mes y el plazo
// mínimo) es de qué formulario salió el pedido, no la ficha.
//
// El request sale del server y no del navegador por dos razones. ficha.info no
// manda CORS, así que un fetch desde la página no llega nunca. Y sobre todo: un
// callable que baje cualquier URL que le pasen es un fetcher abierto hacia
// adentro de la red de GCP, así que el host va en whitelist y se rechaza todo
// lo demás. El mapeo vive en ./ficha.ts, gemelo de scripts/lib/ficha.js.
export const importFromFicha = onCall<ImportFromFichaRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debés iniciar sesión.')
  }
  const callerRole = request.auth.token.role
  if (callerRole !== 'admin' && callerRole !== 'seller') {
    throw new HttpsError('permission-denied', 'Solo admins o sellers pueden importar fichas.')
  }

  const url = (request.data?.url || '').trim()
  if (!esUrlDeFicha(url)) {
    throw new HttpsError('invalid-argument', 'Pegá el link de una ficha de ficha.info (https://ficha.info/p/…).')
  }

  const collectionName = request.data?.collectionName || 'rentals'
  if (collectionName !== 'rentals' && collectionName !== 'sales') {
    throw new HttpsError('invalid-argument', 'collectionName debe ser "rentals" o "sales".')
  }

  let ficha
  try {
    ficha = await fetchFicha(url)
  } catch (e) {
    // failed-precondition y no internal: el problema está en la ficha (no
    // existe, cambió de formato, no responde), no en nuestro código.
    throw new HttpsError('failed-precondition', `No se pudo leer la ficha: ${(e as Error).message}`)
  }

  const { prop, avisos } = collectionName === 'sales' ? fichaToSale(ficha) : fichaToRental(ficha)

  // select() sin campos trae solo los ids, que es lo único que hace falta para
  // saber qué números de la serie están tomados.
  const snap = await db.collection(collectionName).select().get()
  const ids = snap.docs.map((d) => d.id)

  return {
    prop,
    avisos,
    sugerencias: { id: collectionName === 'sales' ? proximoIdVen(ids) : proximoIdAlq(ids) },
  }
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
