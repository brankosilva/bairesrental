<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../../stores/auth'
import AppShellLayout from '../../../layouts/AppShellLayout.vue'

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

const authStore = useAuthStore()
const leads = ref<LeadDoc[]>([])
const loading = ref(true)
const openNotesFor = ref<string | null>(null)
const newNote = ref('')
const savingId = ref<string | null>(null)

async function loadLeads() {
  const uid = authStore.user?.uid
  if (!uid) return
  // Sorted client-side rather than via an `orderBy` in the query — an
  // equality filter (sellerUid) plus an orderBy on a different field
  // (createdAt) needs a composite Firestore index, which doesn't exist
  // yet and isn't worth provisioning for what's expected to be a small
  // per-seller lead volume.
  const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore')
  const { getFirebaseApp } = await import('../../../firebase/client')
  const snap = await getDocs(query(collection(getFirestore(getFirebaseApp()), 'leads'), where('sellerUid', '==', uid)))
  leads.value = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeadDoc, 'id'>) }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

onMounted(async () => {
  await authStore.init()
  await loadLeads()
  loading.value = false
})

async function updateStatus(lead: LeadDoc, status: LeadDoc['status']) {
  savingId.value = lead.id
  try {
    const { getFirestore, doc, updateDoc } = await import('firebase/firestore')
    const { getFirebaseApp } = await import('../../../firebase/client')
    await updateDoc(doc(getFirestore(getFirebaseApp()), 'leads', lead.id), { status, updatedAt: new Date() })
    lead.status = status
  } finally {
    savingId.value = null
  }
}

async function addNote(lead: LeadDoc) {
  if (!newNote.value.trim()) return
  savingId.value = lead.id
  try {
    const { getFirestore, doc, updateDoc, arrayUnion } = await import('firebase/firestore')
    const { getFirebaseApp } = await import('../../../firebase/client')
    const note = { text: newNote.value.trim(), createdAt: new Date().toISOString() }
    await updateDoc(doc(getFirestore(getFirebaseApp()), 'leads', lead.id), { notes: arrayUnion(note), updatedAt: new Date() })
    lead.notes = [...(lead.notes || []), note]
    newNote.value = ''
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <AppShellLayout>
    <main class="container py-4">
      <h1 class="h4 mb-3">Mis leads ({{ leads.length }})</h1>

      <p v-if="loading">Cargando…</p>
      <p v-else-if="!leads.length" class="text-muted small">
        Todavía no tenés leads. Generá un link en <router-link :to="{ name: 'seller-links' }">Links</router-link> y compartilo.
      </p>

      <div v-for="lead in leads" :key="lead.id" class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between flex-wrap gap-2">
            <div>
              <strong>{{ lead.name }}</strong> — {{ lead.phone }}
              <div class="small text-muted">
                {{ lead.propertyId || 'Consulta general' }} · vía {{ lead.source === 'link' ? 'link compartido' : lead.source }}
              </div>
            </div>
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
          </div>

          <button class="btn btn-sm btn-link ps-0" @click="openNotesFor = openNotesFor === lead.id ? null : lead.id">
            {{ openNotesFor === lead.id ? 'Ocultar notas' : `Notas (${lead.notes?.length || 0})` }}
          </button>

          <div v-if="openNotesFor === lead.id">
            <ul class="list-unstyled small mb-2">
              <li v-for="(n, i) in lead.notes" :key="i" class="border-bottom py-1">{{ n.text }}</li>
            </ul>
            <div class="d-flex gap-2">
              <input v-model="newNote" type="text" class="form-control form-control-sm" placeholder="Agregar nota…" @keyup.enter="addNote(lead)" />
              <button class="btn btn-sm btn-outline-primary" :disabled="savingId === lead.id" @click="addNote(lead)">Agregar</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </AppShellLayout>
</template>
