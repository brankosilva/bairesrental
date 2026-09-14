<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { useFirestore } from 'vuefire'

// Ported from app/src/pages/app/seller/Leads.vue. Raw inline Firestore
// query on `leads` filtered by sellerUid, sorted CLIENT-SIDE rather than
// via Firestore `orderBy` — deliberate, to avoid needing a composite index
// (sellerUid equality + createdAt order). Kept exactly as the old file did
// it; do not "fix" this by adding an orderBy.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis leads', meta: [{ name: 'robots', content: 'noindex' }] })

interface Note {
  text: string
  createdAt: unknown
}

interface LeadDoc {
  id: string
  name: string
  phone: string
  propertyId: string | null
  propertyType: 'rental' | 'sale' | null
  source: string
  status: 'new' | 'contacted' | 'won' | 'lost'
  notes: Note[]
  createdAt?: { seconds: number }
}

const user = useCurrentUser()
const leads = ref<LeadDoc[]>([])
const loading = ref(true)
const openNotesFor = ref<string | null>(null)
const newNote = ref('')
const savingId = ref<string | null>(null)

async function loadLeads() {
  const uid = user.value?.uid
  if (!uid) return
  const snap = await getDocs(query(collection(useFirestore(), 'leads'), where('sellerUid', '==', uid)))
  leads.value = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeadDoc, 'id'>) }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

onMounted(async () => {
  await loadLeads()
  loading.value = false
})

async function updateStatus(lead: LeadDoc, status: LeadDoc['status']) {
  savingId.value = lead.id
  try {
    await updateDoc(doc(useFirestore(), 'leads', lead.id), { status, updatedAt: new Date() })
    lead.status = status
  } finally {
    savingId.value = null
  }
}

async function addNote(lead: LeadDoc) {
  if (!newNote.value.trim()) return
  savingId.value = lead.id
  try {
    const note = { text: newNote.value.trim(), createdAt: new Date().toISOString() }
    await updateDoc(doc(useFirestore(), 'leads', lead.id), { notes: arrayUnion(note), updatedAt: new Date() })
    lead.notes = [...(lead.notes || []), note]
    newNote.value = ''
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <main class="container py-4">
    <h1 class="h4 mb-3">Mis leads ({{ leads.length }})</h1>

    <p v-if="loading">Cargando…</p>
    <p v-else-if="!leads.length" class="text-muted small">
      Todavía no tenés leads. Generá un link en <NuxtLink to="/app/seller/links">Links</NuxtLink> y compartilo.
    </p>

    <div v-if="leads.length" class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th>Contacto</th>
            <th>Propiedad / origen</th>
            <th>Estado</th>
            <th class="text-end">Notas</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="lead in leads" :key="lead.id">
            <tr>
              <td><strong>{{ lead.name }}</strong><div class="small text-muted">{{ lead.phone }}</div></td>
              <td class="small text-muted">
                {{ lead.propertyId || 'Consulta general' }} · vía {{ lead.source === 'link' ? 'link compartido' : lead.source }}
              </td>
              <td>
                <select
                  class="form-select form-select-sm"
                  style="width: auto"
                  :disabled="savingId === lead.id"
                  :value="lead.status"
                  @change="updateStatus(lead, ($event.target as HTMLSelectElement).value as LeadDoc['status'])"
                >
                  <option value="new">nuevo</option>
                  <option value="contacted">contactado</option>
                  <option value="won">ganado</option>
                  <option value="lost">perdido</option>
                </select>
              </td>
              <td class="text-end">
                <button
                  class="btn btn-sm btn-outline-secondary"
                  :title="openNotesFor === lead.id ? 'Ocultar notas' : 'Ver notas'"
                  @click="openNotesFor = openNotesFor === lead.id ? null : lead.id"
                >
                  <i class="bi bi-chat-dots"></i> {{ lead.notes?.length || 0 }}
                </button>
              </td>
            </tr>
            <tr v-if="openNotesFor === lead.id">
              <td colspan="4" class="bg-light-subtle">
                <ul class="list-unstyled small mb-2">
                  <li v-for="(n, i) in lead.notes" :key="i" class="border-bottom py-1">{{ n.text }}</li>
                  <li v-if="!lead.notes?.length" class="text-muted py-1">Todavía no hay notas.</li>
                </ul>
                <div class="d-flex gap-2">
                  <input v-model="newNote" type="text" class="form-control form-control-sm" placeholder="Agregar nota…" @keyup.enter="addNote(lead)" />
                  <button class="btn btn-sm btn-outline-primary" :disabled="savingId === lead.id" @click="addNote(lead)">Agregar</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </main>
</template>
