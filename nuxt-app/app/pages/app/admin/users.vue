<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Ported from app/src/pages/app/admin/Users.vue, which was role assignment
// only (a select + Guardar per row). N8 turns it into the full CRUD the
// other two admin screens already had: invite (C), list (R), inline row
// edit of name/phone/role plus a suspend toggle (U), and delete (D).
//
// Every write goes through a Cloud Function on purpose — firestore.rules
// has `allow write: if false` on /users/{uid} so the Firestore profile and
// the Auth custom claim can never drift apart (only the Admin SDK can
// write both). That's also why there's no removeOne('users', ...) here the
// way admin/rentals.vue has one for listings.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Usuarios', meta: [{ name: 'robots', content: 'noindex' }] })

type Role = 'admin' | 'seller' | 'owner'

interface UserDoc {
  id: string
  email: string | null
  displayName?: string | null
  phone?: string | null
  role: Role | null
  disabled?: boolean
}

function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(getFunctions(useFirebaseApp(), 'southamerica-east1'), name)
}

const me = useCurrentUser()
const users = ref<UserDoc[]>([])
const loading = ref(true)
const search = ref('')
const feedback = ref<{ text: string; tone: 'warning' | 'info' } | null>(null)

function fail(e: unknown) {
  feedback.value = { text: (e as Error).message, tone: 'warning' }
}

async function reload() {
  users.value = (await listAll<UserDoc>('users')).sort((a, b) =>
    (a.email || '').localeCompare(b.email || ''),
  )
}

onMounted(async () => {
  await reload()
  loading.value = false
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) =>
    `${u.email || ''} ${u.displayName || ''} ${u.phone || ''} ${u.role || ''} ${u.id}`.toLowerCase().includes(q),
  )
})

// --- C: invite ---
// Creates the Firebase Auth account (if it doesn't exist yet) and assigns
// the role in one step via the inviteUser callable, instead of requiring a
// trip to the Firebase console — see nuxt-app/functions/src/index.ts.
// generatePasswordResetLink() returns a real link with no email dependency;
// the admin copies it and sends it however they already reach this person
// (WhatsApp, per this business's usual channel).
const inviteEmail = ref('')
const inviteName = ref('')
const invitePhone = ref('')
const inviteRole = ref<Role>('seller')
const inviting = ref(false)
const inviteError = ref('')
const inviteLink = ref('')
const inviteLinkCopied = ref(false)

async function sendInvite() {
  const email = inviteEmail.value.trim()
  if (!email) return
  inviting.value = true
  inviteError.value = ''
  inviteLink.value = ''
  try {
    const { data } = await callable<
      { email: string; role: Role; displayName: string; phone: string },
      { uid: string; link: string }
    >('inviteUser')({
      email,
      role: inviteRole.value,
      displayName: inviteName.value.trim(),
      phone: invitePhone.value.trim(),
    })
    inviteLink.value = data.link
    inviteEmail.value = ''
    inviteName.value = ''
    invitePhone.value = ''
    await reload()
  } catch (e) {
    inviteError.value = (e as Error).message
  } finally {
    inviting.value = false
  }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    inviteLinkCopied.value = true
    setTimeout(() => (inviteLinkCopied.value = false), 2000)
  } catch {
    prompt('Copiá el link:', inviteLink.value)
  }
}

// --- U: inline row edit + suspend toggle ---
// One row at a time, so the Guardar button is never ambiguous about which
// row it belongs to. The draft is a copy: cancelling leaves the row's
// rendered values untouched without needing a reload.
const editingUid = ref<string | null>(null)
const draft = ref<{ displayName: string; phone: string; role: Role | '' }>({ displayName: '', phone: '', role: '' })
const busyUid = ref<string | null>(null)

function startEdit(u: UserDoc) {
  feedback.value = null
  editingUid.value = u.id
  draft.value = { displayName: u.displayName || '', phone: u.phone || '', role: u.role || '' }
}

function cancelEdit() {
  editingUid.value = null
}

async function saveEdit(u: UserDoc) {
  // Demoting yourself works (the backend only blocks it when you're the
  // last admin left), but you lose this screen the moment the ID token
  // refreshes — worth one confirm rather than a surprise redirect.
  if (u.id === me.value?.uid && draft.value.role !== 'admin') {
    if (!confirm('Te estás sacando el rol de admin a vos mismo. Vas a perder el acceso al panel. ¿Seguro?')) return
  }
  busyUid.value = u.id
  feedback.value = null
  try {
    await callable<{ uid: string; displayName: string; phone: string; role: Role | null }, { ok: boolean }>(
      'updateUser',
    )({
      uid: u.id,
      displayName: draft.value.displayName,
      phone: draft.value.phone,
      role: (draft.value.role || null) as Role | null,
    })
    u.displayName = draft.value.displayName.trim() || null
    u.phone = draft.value.phone.trim() || null
    u.role = (draft.value.role || null) as Role | null
    editingUid.value = null
  } catch (e) {
    fail(e)
  } finally {
    busyUid.value = null
  }
}

async function toggleDisabled(u: UserDoc) {
  const next = !u.disabled
  if (next && !confirm(`¿Suspender a ${u.email || u.id}? No va a poder iniciar sesión hasta que lo reactives.`)) return
  busyUid.value = u.id
  feedback.value = null
  try {
    await callable<{ uid: string; disabled: boolean }, { ok: boolean }>('updateUser')({ uid: u.id, disabled: next })
    u.disabled = next
  } catch (e) {
    fail(e)
  } finally {
    busyUid.value = null
  }
}

// --- D: delete ---
// The callable refuses if the user still has rentals/sales assigned, and
// says how many — that message is surfaced in the alert at the top of the
// page rather than swallowed, since it's the admin's cue to reassign the
// listings (or suspend instead of deleting).
async function onDelete(u: UserDoc) {
  if (
    !confirm(
      `¿Eliminar a ${u.email || u.id}? Se borra la cuenta de acceso y el perfil, y no se puede deshacer.\n\n` +
        'Si la persona puede volver, conviene suspenderla en lugar de eliminarla.',
    )
  )
    return
  busyUid.value = u.id
  feedback.value = null
  try {
    const { data } = await callable<{ uid: string }, { ok: boolean; linksDeactivated: number }>('deleteUser')({
      uid: u.id,
    })
    users.value = users.value.filter((x) => x.id !== u.id)
    if (data.linksDeactivated > 0) {
      feedback.value = {
        text: `Usuario eliminado. Se desactivaron ${data.linksDeactivated} link(s) de seguimiento suyos; los leads que ya habían entrado por esos links se mantienen.`,
        tone: 'info',
      }
    }
  } catch (e) {
    fail(e)
  } finally {
    busyUid.value = null
  }
}
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Usuarios ({{ users.length }})</h1>

    <div v-if="feedback" class="alert d-flex align-items-start gap-2" :class="`alert-${feedback.tone}`" role="alert">
      <i class="bi flex-shrink-0" :class="feedback.tone === 'info' ? 'bi-info-circle' : 'bi-exclamation-triangle'"></i>
      <div class="small flex-grow-1">{{ feedback.text }}</div>
      <button type="button" class="btn-close flex-shrink-0" aria-label="Cerrar" @click="feedback = null"></button>
    </div>

    <AdminSection title="Invitar usuario">
      <p class="text-muted small">
        Creá el acceso de un vendedor, propietario u otro admin acá mismo — no hace falta pasar por la consola de
        Firebase. Se genera un link para que la persona defina su contraseña; copialo y enviáselo por WhatsApp.
      </p>
      <form class="row g-2 align-items-end" @submit.prevent="sendInvite">
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="form-label small">Email</label>
          <input v-model="inviteEmail" type="email" required class="form-control" placeholder="nombre@ejemplo.com" />
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="form-label small">Nombre <span class="text-muted">(opcional)</span></label>
          <input v-model="inviteName" type="text" class="form-control" placeholder="Nombre y apellido" />
        </div>
        <div class="col-8 col-sm-6 col-lg-2">
          <label class="form-label small">Teléfono <span class="text-muted">(opcional)</span></label>
          <input v-model="invitePhone" type="tel" class="form-control" placeholder="11 5555-5555" />
        </div>
        <div class="col-4 col-sm-4 col-lg-2">
          <label class="form-label small">Rol</label>
          <select v-model="inviteRole" class="form-select">
            <option value="seller">seller</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </div>
        <div class="col-12 col-sm-2">
          <button type="submit" class="btn btn-primary w-100" :disabled="inviting || !inviteEmail.trim()">
            {{ inviting ? '…' : 'Invitar' }}
          </button>
        </div>
      </form>

      <p v-if="inviteError" class="text-danger small mt-2 mb-0">{{ inviteError }}</p>

      <div v-if="inviteLink" class="alert alert-success d-flex align-items-center gap-2 mt-3 mb-0">
        <i class="bi bi-check-circle"></i>
        <div class="flex-grow-1 small text-truncate">{{ inviteLink }}</div>
        <button type="button" class="btn btn-sm btn-outline-success flex-shrink-0" @click="copyInviteLink">
          <i :class="inviteLinkCopied ? 'bi bi-clipboard-check' : 'bi bi-clipboard'"></i>
          {{ inviteLinkCopied ? 'Copiado' : 'Copiar link' }}
        </button>
      </div>
    </AdminSection>

    <AdminSection title="Usuarios existentes">
      <input
        v-model="search"
        type="search"
        class="form-control mb-3"
        placeholder="Buscar por email, nombre, teléfono o rol…"
      />

      <p v-if="loading">Cargando…</p>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Estado</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filtered" :key="u.id" :class="{ 'table-light text-muted': u.disabled }">
              <td>
                {{ u.email || '—' }}
                <span v-if="u.id === me?.uid" class="badge text-bg-info ms-1">vos</span>
                <div class="small text-muted">{{ u.id }}</div>
              </td>

              <template v-if="editingUid === u.id">
                <td><input v-model="draft.displayName" class="form-control form-control-sm" placeholder="Nombre" /></td>
                <td><input v-model="draft.phone" class="form-control form-control-sm" placeholder="Teléfono" /></td>
                <td>
                  <select v-model="draft.role" class="form-select form-select-sm" style="width: auto">
                    <option value="">sin asignar</option>
                    <option value="admin">admin</option>
                    <option value="seller">seller</option>
                    <option value="owner">owner</option>
                  </select>
                </td>
                <td>—</td>
                <td class="text-end">
                  <div class="d-inline-flex gap-1">
                    <button class="btn btn-sm btn-primary" :disabled="busyUid === u.id" @click="saveEdit(u)">
                      {{ busyUid === u.id ? 'Guardando…' : 'Guardar' }}
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" :disabled="busyUid === u.id" @click="cancelEdit">
                      Cancelar
                    </button>
                  </div>
                </td>
              </template>

              <template v-else>
                <td>{{ u.displayName || '—' }}</td>
                <td>{{ u.phone || '—' }}</td>
                <td>
                  <span v-if="u.role" class="badge text-bg-secondary">{{ u.role }}</span>
                  <span v-else class="badge text-bg-light text-muted">sin asignar</span>
                </td>
                <td>
                  <span v-if="u.disabled" class="badge text-bg-warning">suspendido</span>
                  <span v-else class="badge text-bg-success">activo</span>
                </td>
                <td class="text-end">
                  <div class="d-inline-flex gap-1">
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      title="Editar"
                      :disabled="busyUid === u.id"
                      @click="startEdit(u)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      class="btn btn-sm"
                      :class="u.disabled ? 'btn-outline-success' : 'btn-outline-warning'"
                      :title="u.disabled ? 'Reactivar' : 'Suspender'"
                      :disabled="busyUid === u.id || u.id === me?.uid"
                      @click="toggleDisabled(u)"
                    >
                      <i :class="u.disabled ? 'bi bi-person-check' : 'bi bi-person-slash'"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      title="Eliminar"
                      :disabled="busyUid === u.id || u.id === me?.uid"
                      @click="onDelete(u)"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </template>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="6" class="text-muted text-center py-3">No hay usuarios que coincidan con la búsqueda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminSection>
  </main>
</template>
