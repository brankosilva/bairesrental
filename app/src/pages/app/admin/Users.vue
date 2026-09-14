<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { listAll } from '../../../data/adminCrud'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'

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
    const { getFunctions, httpsCallable } = await import('firebase/functions')
    const { getFirebaseApp } = await import('../../../firebase/client')
    const setUserRole = httpsCallable(getFunctions(getFirebaseApp(), 'southamerica-east1'), 'setUserRole')
    await setUserRole({ uid, role })
    const user = users.value.find((u) => u.id === uid)
    if (user) user.role = role as UserDoc['role']
  } catch (e) {
    alert(`Error al asignar el rol: ${(e as Error).message}`)
  } finally {
    savingUid.value = null
  }
}
</script>

<template>
  <AppShellLayout>
    <main class="container py-4">
      <h1 class="h4 mb-3">Usuarios ({{ users.length }})</h1>
      <p class="text-muted small">
        Los usuarios se crean automáticamente al iniciar sesión por primera vez (con rol sin asignar). Asignales un rol acá.
        Para crear una cuenta nueva, hacerlo desde la consola de Firebase Authentication por ahora.
      </p>

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
    </main>
  </AppShellLayout>
</template>
