<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Ported from app/src/pages/app/admin/Users.vue. Role assignment goes
// through the existing, unchanged `setUserRole` callable — same payload
// shape, just sourced from useFirebaseApp() (nuxt-vuefire's canonical
// Firebase app) instead of the old app's second hand-rolled singleton.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Usuarios', meta: [{ name: 'robots', content: 'noindex' }] })

interface UserDoc {
  id: string
  email: string | null
  role: 'admin' | 'seller' | 'owner' | null
}

const users = ref<UserDoc[]>([])
const loading = ref(true)
const savingUid = ref<string | null>(null)
const pendingRole = ref<Record<string, string>>({})

onMounted(async () => {
  users.value = await listAll<UserDoc>('users')
  for (const u of users.value) pendingRole.value[u.id] = u.role || ''
  loading.value = false
})

async function saveRole(uid: string) {
  const role = pendingRole.value[uid]
  if (!role) return
  savingUid.value = uid
  try {
    const setUserRole = httpsCallable(getFunctions(useFirebaseApp(), 'southamerica-east1'), 'setUserRole')
    await setUserRole({ uid, role })
    const user = users.value.find((u) => u.id === uid)
    if (user) user.role = role as UserDoc['role']
  } catch (e) {
    alert(`Error al asignar el rol: ${(e as Error).message}`)
  } finally {
    savingUid.value = null
  }
}

// Invite flow: creates the Firebase Auth account (if it doesn't exist yet)
// and assigns the role in one step via the inviteUser callable, instead of
// requiring a trip to the Firebase console — see app/functions/src/index.ts.
// generatePasswordResetLink() returns a real link with no email dependency;
// the admin copies it and sends it however they already reach this person
// (WhatsApp, per this business's usual channel).
const inviteEmail = ref('')
const inviteRole = ref<'admin' | 'seller' | 'owner'>('seller')
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
    const inviteUser = httpsCallable<{ email: string; role: string }, { uid: string; link: string }>(
      getFunctions(useFirebaseApp(), 'southamerica-east1'),
      'inviteUser',
    )
    const { data } = await inviteUser({ email, role: inviteRole.value })
    inviteLink.value = data.link
    inviteEmail.value = ''
    users.value = await listAll<UserDoc>('users')
    for (const u of users.value) pendingRole.value[u.id] = u.role || ''
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
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Usuarios ({{ users.length }})</h1>

    <AdminSection title="Invitar usuario">
      <p class="text-muted small">
        Creá el acceso de un vendedor, propietario u otro admin acá mismo — no hace falta pasar por la consola de
        Firebase. Se genera un link para que la persona defina su contraseña; copialo y enviáselo por WhatsApp.
      </p>
      <form class="row g-2 align-items-end" @submit.prevent="sendInvite">
        <div class="col-12 col-sm-6">
          <label class="form-label small">Email</label>
          <input v-model="inviteEmail" type="email" required class="form-control" placeholder="nombre@ejemplo.com" />
        </div>
        <div class="col-8 col-sm-4">
          <label class="form-label small">Rol</label>
          <select v-model="inviteRole" class="form-select">
            <option value="seller">seller</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </div>
        <div class="col-4 col-sm-2">
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
      <p v-if="loading">Cargando…</p>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Email</th>
              <th>UID</th>
              <th>Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.email || '—' }}</td>
              <td class="small text-muted">{{ u.id }}</td>
              <td>
                <select v-model="pendingRole[u.id]" class="form-select form-select-sm" style="width: auto">
                  <option value="">sin asignar</option>
                  <option value="admin">admin</option>
                  <option value="seller">seller</option>
                  <option value="owner">owner</option>
                </select>
              </td>
              <td>
                <button
                  class="btn btn-sm btn-outline-primary"
                  :disabled="savingUid === u.id || !pendingRole[u.id] || pendingRole[u.id] === u.role"
                  @click="saveRole(u.id)"
                >
                  {{ savingUid === u.id ? 'Guardando…' : 'Guardar' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminSection>
  </main>
</template>
