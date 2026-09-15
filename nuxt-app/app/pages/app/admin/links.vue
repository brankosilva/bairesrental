<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import {
  type LinkRow,
  channelLabel,
  outcomeLabel,
  outcomeClass,
  n,
  relativeTime,
  totalsFor,
  formatRate,
  toMillis,
  useLinkUrl,
} from '~/composables/useLinkStats'

// Panel de links de TODOS los vendedores. El equivalente admin de
// /app/seller/links, que sólo ve los propios.
//
// Lee la colección entera sin filtro y se apoya en que firestore.rules
// cortocircuita por documento (`isAdmin() || resource.data.sellerUid == ...`).
// Es exactamente la misma forma que admin/users.vue ya usa en producción con
// listAll('users') contra una regla self-or-admin, así que no es una apuesta.
//
// Escala: con cientos de links esto está bien; con miles habría que pasar a
// un rollup por vendedor (sellerLinkStats/{uid}) mantenido por un trigger
// onDocumentWritten. Deliberadamente fuera de alcance hoy.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Links', meta: [{ name: 'robots', content: 'noindex' }] })

interface UserDoc {
  id: string
  email: string | null
  displayName?: string | null
  role?: string | null
}

const { linkUrl } = useLinkUrl()
const links = ref<LinkRow[]>([])
const users = ref<UserDoc[]>([])
const loading = ref(true)
const savingId = ref<string | null>(null)
const feedback = ref<string | null>(null)

const sellerFilter = ref('')
const search = ref('')
const copiedCode = ref<string | null>(null)

async function reload() {
  const [linkSnap, userList] = await Promise.all([
    getDocs(collection(useFirestore(), 'links')),
    listAll<UserDoc>('users'),
  ])
  links.value = linkSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LinkRow, 'id'>) }))
  users.value = userList
}

onMounted(async () => {
  try {
    await reload()
  } catch (err) {
    feedback.value = (err as Error).message
  } finally {
    loading.value = false
  }
})

function sellerName(uid?: string | null): string {
  if (!uid) return '—'
  const u = users.value.find((x) => x.id === uid)
  return u?.displayName || u?.email || `${uid.slice(0, 8)}…`
}

const globalTotals = computed(() => totalsFor(links.value))

const activeSellers = computed(() => new Set(links.value.map((l) => l.sellerUid).filter(Boolean)).size)

// Ranking por vendedor. Ordenado por aperturas: es la señal de que alguien
// está efectivamente moviendo el catálogo, no de cuántos links generó (que
// se infla solo).
const ranking = computed(() => {
  const bySeller = new Map<string, LinkRow[]>()
  for (const l of links.value) {
    if (!l.sellerUid) continue
    const arr = bySeller.get(l.sellerUid) ?? []
    arr.push(l)
    bySeller.set(l.sellerUid, arr)
  }
  return [...bySeller.entries()]
    .map(([uid, rows]) => ({ uid, name: sellerName(uid), ...totalsFor(rows) }))
    .sort((a, b) => b.opens - a.opens || b.links - a.links)
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return links.value
    .filter((l) => !sellerFilter.value || l.sellerUid === sellerFilter.value)
    .filter((l) => {
      if (!q) return true
      return (
        (l.recipientName || '').toLowerCase().includes(q) ||
        (l.propertyTitulo || '').toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => (toMillis(b.lastOpenAt) ?? 0) - (toMillis(a.lastOpenAt) ?? 0) || n(b.opens) - n(a.opens))
})

async function toggleActive(link: LinkRow) {
  savingId.value = link.id
  try {
    const active = !link.active
    await updateDoc(doc(useFirestore(), 'links', link.id), { active, updatedAt: serverTimestamp() })
    link.active = active
  } catch (err) {
    feedback.value = (err as Error).message
  } finally {
    savingId.value = null
  }
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

function propertyLabel(l: LinkRow) {
  if (l.target === 'catalog' || !l.propertyId) return 'Todo el catálogo del vendedor'
  return l.propertyTitulo || l.propertyId
}
</script>

<template>
  <main class="container py-4" style="max-width: 1100px">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Links</h1>
    </div>
    <p class="text-muted small">Actividad de los links compartidos por todos los vendedores.</p>

    <div v-if="feedback" class="alert alert-warning py-2 small">{{ feedback }}</div>
    <p v-if="loading">Cargando…</p>

    <template v-else>
      <div class="br-stat-row">
        <div class="br-stat"><span class="br-stat-num">{{ globalTotals.links }}</span><span class="br-stat-lbl">Links</span></div>
        <div class="br-stat"><span class="br-stat-num">{{ globalTotals.opens }}</span><span class="br-stat-lbl">Aperturas</span></div>
        <div class="br-stat"><span class="br-stat-num">{{ globalTotals.whatsappClicks }}</span><span class="br-stat-lbl">Contactos</span></div>
        <div class="br-stat">
          <span class="br-stat-num">{{ formatRate(globalTotals.contactRate) }}</span>
          <!-- Intención, no cierre. La etiqueta lo dice para que nadie la
               lea como una tasa de conversión que nadie midió. -->
          <span class="br-stat-lbl">Tasa de contacto</span>
        </div>
        <div class="br-stat"><span class="br-stat-num">{{ activeSellers }}</span><span class="br-stat-lbl">Vendedores</span></div>
      </div>

      <h2 class="h6 mt-4 mb-2">Por vendedor</h2>
      <div v-if="!ranking.length" class="br-app-empty">Todavía no hay links generados.</div>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle br-app-table-compact">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Links</th>
              <th>Aperturas</th>
              <th class="br-app-col-optional">Contactos</th>
              <th class="br-app-col-optional">Tasa</th>
              <th class="br-app-col-optional">Cerrados</th>
              <th class="br-app-col-optional">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in ranking" :key="r.uid">
              <td>
                <button class="btn btn-link p-0 align-baseline text-start" @click="sellerFilter = sellerFilter === r.uid ? '' : r.uid">
                  {{ r.name }}
                </button>
              </td>
              <td>{{ r.links }}</td>
              <td><strong>{{ r.opens }}</strong></td>
              <td class="br-app-col-optional">{{ r.whatsappClicks }}</td>
              <td class="br-app-col-optional">{{ formatRate(r.contactRate) }}</td>
              <td class="br-app-col-optional">{{ r.closed }}</td>
              <td class="br-app-col-optional small text-muted">{{ r.lastActivity ? relativeTime({ seconds: r.lastActivity / 1000 }) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="h6 mt-4 mb-2">Todos los links</h2>
      <div class="row g-2 mb-3">
        <div class="col-12 col-sm-5">
          <select v-model="sellerFilter" class="form-select">
            <option value="">Todos los vendedores</option>
            <option v-for="r in ranking" :key="r.uid" :value="r.uid">{{ r.name }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-7">
          <input v-model="search" type="search" class="form-control" placeholder="Buscar por destinatario, publicación o código…" />
        </div>
      </div>

      <div v-if="!filtered.length" class="br-app-empty">No hay links que coincidan.</div>
      <div v-else class="br-app-list">
        <article
          v-for="l in filtered"
          :key="l.id"
          class="br-link-card"
          :class="{ 'is-inactive': l.active === false, 'is-saving': savingId === l.id }"
        >
          <div class="br-link-main">
            <div class="br-link-ident">
              <strong class="br-link-name">{{ l.recipientName || 'Sin etiquetar' }}</strong>
              <span class="br-link-chip">{{ channelLabel(l.channel) }}</span>
              <span class="br-link-chip">{{ sellerName(l.sellerUid) }}</span>
              <span v-if="l.active === false" class="br-link-chip is-off">Desactivado</span>
            </div>
            <div class="br-link-prop br-app-truncate">{{ propertyLabel(l) }}</div>
            <div class="br-link-stats">
              <span :class="{ 'is-zero': n(l.opens) === 0 }">
                <strong>{{ n(l.opens) }}</strong> {{ n(l.opens) === 1 ? 'apertura' : 'aperturas' }}
              </span>
              <span v-if="n(l.whatsappClicks) > 0" class="is-good">
                <strong>{{ n(l.whatsappClicks) }}</strong> contacto{{ n(l.whatsappClicks) === 1 ? '' : 's' }}
              </span>
              <span class="br-link-when">{{ n(l.opens) ? relativeTime(l.lastOpenAt) : 'sin abrir' }}</span>
            </div>
          </div>

          <div class="br-link-side">
            <span class="br-link-outcome-tag" :class="outcomeClass(l.outcome)">{{ outcomeLabel(l.outcome) }}</span>
            <div class="br-link-actions">
              <button
                class="btn btn-sm btn-outline-secondary br-app-icon-btn"
                :title="copiedCode === l.id ? 'Copiado' : 'Copiar link'"
                :aria-label="copiedCode === l.id ? 'Copiado' : 'Copiar link'"
                @click="copyLink(l.id)"
              >
                <i :class="copiedCode === l.id ? 'bi bi-clipboard-check' : 'bi bi-clipboard'"></i>
              </button>
              <button
                class="btn btn-sm btn-outline-secondary br-app-icon-btn"
                :title="l.active === false ? 'Reactivar' : 'Desactivar'"
                :aria-label="l.active === false ? 'Reactivar' : 'Desactivar'"
                :disabled="savingId === l.id"
                @click="toggleActive(l)"
              >
                <i :class="l.active === false ? 'bi bi-toggle-off' : 'bi bi-toggle-on'"></i>
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>
  </main>
</template>
