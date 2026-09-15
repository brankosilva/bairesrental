<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { RentalProperty, SaleProperty } from '~/types/property'

// Ported from app/src/pages/app/seller/Links.vue. The `links` query is a
// raw inline Firestore query (not through adminCrud.ts, matching the old
// file exactly), filtered by sellerUid per firestore.rules. Link creation
// goes through the existing, unchanged `createTrackableLink` callable.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis links', meta: [{ name: 'robots', content: 'noindex' }] })

interface LinkDoc {
  id: string
  propertyId: string | null
  propertyType: 'rental' | 'sale' | null
  clicks: number
  active: boolean
}

const user = useCurrentUser()
const links = ref<LinkDoc[]>([])
const rentals = ref<(RentalProperty & { id: string })[]>([])
const sales = ref<(SaleProperty & { id: string })[]>([])
const loading = ref(true)
const creating = ref(false)
const copiedCode = ref<string | null>(null)

const selectedType = ref<'' | 'rental' | 'sale'>('')
const selectedPropertyId = ref('')

async function loadLinks() {
  const uid = user.value?.uid
  if (!uid) return
  const snap = await getDocs(query(collection(useFirestore(), 'links'), where('sellerUid', '==', uid)))
  links.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LinkDoc, 'id'>) }))
}

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    ;[rentals.value, sales.value] = await Promise.all([
      listBySeller<RentalProperty>('rentals', uid),
      listBySeller<SaleProperty>('sales', uid),
    ])
    await loadLinks()
  }
  loading.value = false
})

async function createLink() {
  creating.value = true
  try {
    const fn = httpsCallable(getFunctions(useFirebaseApp(), 'southamerica-east1'), 'createTrackableLink')
    await fn({
      propertyId: selectedType.value ? selectedPropertyId.value : null,
      propertyType: selectedType.value || null,
    })
    selectedType.value = ''
    selectedPropertyId.value = ''
    await loadLinks()
  } finally {
    creating.value = false
  }
}

function linkUrl(code: string) {
  return `https://www.bairesrental.com.ar/l/${code}`
}

async function copyLink(code: string) {
  try {
    await navigator.clipboard.writeText(linkUrl(code))
    copiedCode.value = code
    setTimeout(() => (copiedCode.value = null), 2000)
  } catch {
    prompt('Copiá el link:', linkUrl(code))
  }
}

function propertyLabel(link: LinkDoc) {
  if (!link.propertyId) return 'Catálogo general'
  const list = link.propertyType === 'rental' ? rentals.value : sales.value
  return list.find((p) => p.id === link.propertyId)?.titulo || link.propertyId
}
</script>

<template>
  <main class="container py-4" style="max-width: 640px">
    <h1 class="h4 mb-3">Mis links</h1>
    <p class="text-muted small">
      Generá un link para compartir con un posible cliente. Cuando alguien lo abre y te contacta, queda registrado
      como un lead tuyo en <NuxtLink to="/app/seller/leads">Leads</NuxtLink>.
    </p>

    <form class="card card-body mb-4" @submit.prevent="createLink">
      <label class="form-label small">¿A qué querés que apunte?</label>
      <!-- N9: eran col-5/col-5/col-2 fijos dentro de un contenedor de 640px, o
           sea ~58px para "Generar" en un celular. Ahora apila en xs. -->
      <div class="row g-2">
        <div class="col-12 col-sm-5">
          <select v-model="selectedType" class="form-select">
            <option value="">Catálogo general</option>
            <option value="rental">Un alquiler mío</option>
            <option value="sale">Una venta mía</option>
          </select>
        </div>
        <div v-if="selectedType" class="col-12 col-sm-5">
          <select v-model="selectedPropertyId" class="form-select" required>
            <option value="" disabled>Elegir propiedad…</option>
            <option v-for="p in selectedType === 'rental' ? rentals : sales" :key="p.id" :value="p.id">{{ p.titulo }}</option>
          </select>
        </div>
        <div class="col-12" :class="selectedType ? 'col-sm-2' : 'col-sm-7'">
          <button type="submit" class="btn btn-primary w-100" :disabled="creating || (!!selectedType && !selectedPropertyId)">
            {{ creating ? '…' : 'Generar' }}
          </button>
        </div>
      </div>
    </form>

    <p v-if="loading">Cargando…</p>
    <div v-else-if="!links.length" class="text-muted small">Todavía no generaste ningún link.</div>
    <!-- N9: la URL completa no entra en la fila de un celular y empujaba la
         tabla a scroll horizontal. Ahora la columna "Link" se trunca y la de
         clicks se esconde en mobile (el dato sigue en la fila, debajo del
         nombre). -->
    <div v-else class="table-responsive">
      <table class="table table-sm align-middle br-app-table-compact">
        <thead>
          <tr>
            <th>Apunta a</th>
            <th>Link</th>
            <th class="br-app-col-optional">Clicks</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in links" :key="l.id">
            <td>
              <span class="br-app-truncate">{{ propertyLabel(l) }}</span>
              <span class="small text-muted d-md-none">{{ l.clicks }} clicks</span>
            </td>
            <td class="small text-muted"><span class="br-app-truncate">{{ linkUrl(l.id) }}</span></td>
            <td class="br-app-col-optional">{{ l.clicks }}</td>
            <td>
              <button
                class="btn btn-sm btn-outline-secondary br-app-icon-btn"
                :title="copiedCode === l.id ? 'Copiado' : 'Copiar link'"
                :aria-label="copiedCode === l.id ? 'Copiado' : 'Copiar link'"
                @click="copyLink(l.id)"
              >
                <i :class="copiedCode === l.id ? 'bi bi-clipboard-check' : 'bi bi-clipboard'"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
