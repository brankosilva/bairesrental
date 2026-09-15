<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, where, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { LinkChannel, LinkOpenEvent, LinkOutcome, SellerProfile } from '~/types/link'
import { LINK_CHANNELS, LINK_OUTCOMES } from '~/types/link'
import {
  type LinkRow,
  channelLabel,
  outcomeLabel,
  outcomeClass,
  deviceLabel,
  n,
  relativeTime,
  eventDateTime,
  distinctVisitors,
  splitEvents,
  toMillis,
  useLinkUrl,
} from '~/composables/useLinkStats'

// Reescritura completa de la pantalla de links.
//
// Lo que había medía mal y mostraba poco: una columna "Clicks" que en
// realidad contaba leads (el único incremento de ese campo estaba en
// submitLead, nunca en la apertura del link), links sin destinatario —o sea
// que el vendedor no sabía cuál le había mandado a quién— y una URL armada
// contra www.bairesrental.com.ar, que todavía sirve el sitio estático viejo
// y no tiene ruta /l/. Ahora:
//
//  · cada link se genera PARA alguien, con nombre y canal;
//  · las aperturas las cuenta el servidor (server/routes/l/[code].get.ts);
//  · "visitantes" ≠ "aperturas": la misma persona abriendo tres veces es un
//    visitante, y eso es justo lo que el vendedor quiere saber;
//  · las vistas previas de WhatsApp/Instagram se cuentan aparte y se
//    muestran plegadas, para que no inflen el número.
//
// La query de `links` sigue siendo inline filtrada por sellerUid (lo exige
// firestore.rules) y el orden se hace del lado del cliente, misma convención
// que leads.vue — no agregar orderBy, haría falta un índice compuesto.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis links', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const { linkUrl } = useLinkUrl()

const links = ref<LinkRow[]>([])
const rentals = ref<(RentalProperty & { id: string })[]>([])
const sales = ref<(SaleProperty & { id: string })[]>([])
const profile = ref<SellerProfile | null>(null)
const loading = ref(true)
const creating = ref(false)
const copiedCode = ref<string | null>(null)
const savingId = ref<string | null>(null)
const feedback = ref<{ text: string; tone: 'success' | 'warning' } | null>(null)

// Actividad por link, cargada recién cuando se despliega una fila: son N
// lecturas por link y casi siempre mirás uno solo.
const openFor = ref<string | null>(null)
const events = ref<Record<string, LinkOpenEvent[]>>({})
const loadingEvents = ref(false)
const showBotsFor = ref<string | null>(null)

const targetKind = ref<'rental' | 'sale' | 'catalog'>('rental')
const selectedPropertyId = ref('')
const recipientName = ref('')
const channel = ref<LinkChannel>('whatsapp')
const note = ref('')

const propertyChoices = computed(() => (targetKind.value === 'sale' ? sales.value : rentals.value))

const sortedLinks = computed(() =>
  [...links.value].sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0)),
)

async function loadLinks() {
  const uid = user.value?.uid
  if (!uid) return
  const snap = await getDocs(query(collection(useFirestore(), 'links'), where('sellerUid', '==', uid)))
  links.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LinkRow, 'id'>) }))
}

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    const [r, s, p] = await Promise.all([
      listBySeller<RentalProperty>('rentals', uid),
      listBySeller<SaleProperty>('sales', uid),
      getDoc(doc(useFirestore(), 'sellerProfiles', uid)),
    ])
    rentals.value = r
    sales.value = s
    profile.value = p.exists() ? (p.data() as SellerProfile) : null
    await loadLinks()
  }
  loading.value = false
})

async function createLink() {
  if (!recipientName.value.trim()) return
  creating.value = true
  feedback.value = null
  try {
    const fn = httpsCallable<Record<string, unknown>, { code: string; existing: boolean }>(
      getFunctions(useFirebaseApp(), 'southamerica-east1'),
      'createTrackableLink',
    )
    const res = await fn({
      target: targetKind.value === 'catalog' ? 'catalog' : 'property',
      propertyId: targetKind.value === 'catalog' ? null : selectedPropertyId.value,
      propertyType: targetKind.value === 'catalog' ? null : targetKind.value,
      recipientName: recipientName.value.trim(),
      channel: channel.value,
      note: note.value.trim() || null,
    })
    await loadLinks()
    // La función es idempotente: pedir dos veces el mismo link para la misma
    // persona devuelve el que ya existía. Decirlo evita que el vendedor
    // piense que no funcionó y siga tocando el botón.
    feedback.value = res.data.existing
      ? { text: `Ya tenías un link para ${recipientName.value.trim()} en esa publicación: es el mismo.`, tone: 'success' }
      : { text: 'Link generado y copiado. Mandáselo.', tone: 'success' }
    await copyLink(res.data.code)
    recipientName.value = ''
    note.value = ''
    selectedPropertyId.value = ''
  } catch (err) {
    feedback.value = { text: (err as Error).message, tone: 'warning' }
  } finally {
    creating.value = false
  }
}

async function copyLink(code: string) {
  const url = linkUrl(code)
  try {
    await navigator.clipboard.writeText(url)
    copiedCode.value = code
    setTimeout(() => (copiedCode.value = null), 2000)
  } catch {
    prompt('Copiá el link:', url)
  }
}

async function setOutcome(link: LinkRow, outcome: LinkOutcome) {
  savingId.value = link.id
  try {
    await updateDoc(doc(useFirestore(), 'links', link.id), { outcome, updatedAt: serverTimestamp() })
    link.outcome = outcome
  } catch (err) {
    feedback.value = { text: (err as Error).message, tone: 'warning' }
  } finally {
    savingId.value = null
  }
}

async function toggleActive(link: LinkRow) {
  savingId.value = link.id
  try {
    const active = !link.active
    await updateDoc(doc(useFirestore(), 'links', link.id), { active, updatedAt: serverTimestamp() })
    link.active = active
  } catch (err) {
    feedback.value = { text: (err as Error).message, tone: 'warning' }
  } finally {
    savingId.value = null
  }
}

async function toggleActivity(link: LinkRow) {
  if (openFor.value === link.id) {
    openFor.value = null
    return
  }
  openFor.value = link.id
  if (events.value[link.id]) return
  loadingEvents.value = true
  try {
    const snap = await getDocs(collection(useFirestore(), 'links', link.id, 'opens'))
    events.value[link.id] = snap.docs
      .map((d) => d.data() as LinkOpenEvent)
      .sort((a, b) => (toMillis(b.at) ?? 0) - (toMillis(a.at) ?? 0))
  } catch (err) {
    feedback.value = { text: (err as Error).message, tone: 'warning' }
  } finally {
    loadingEvents.value = false
  }
}

function humanEvents(id: string) {
  return splitEvents(events.value[id] || []).human
}
function botEvents(id: string) {
  return splitEvents(events.value[id] || []).bots
}
function refererHost(referer: string | null) {
  return referer ? referer.replace(/^https?:\/\//, '').split('/')[0] : ''
}

function propertyLabel(link: LinkRow) {
  if (link.target === 'catalog' || !link.propertyId) return 'Todo mi catálogo'
  if (link.propertyTitulo) return link.propertyTitulo
  const list = link.propertyType === 'rental' ? rentals.value : sales.value
  return list.find((p) => p.id === link.propertyId)?.titulo || link.propertyId
}

const canSubmit = computed(
  () => !!recipientName.value.trim() && (targetKind.value === 'catalog' || !!selectedPropertyId.value),
)
</script>

<template>
  <main class="container py-4" style="max-width: 900px">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Mis links</h1>
      <NuxtLink to="/app/seller/profile" class="btn btn-sm btn-outline-secondary">Mi ficha</NuxtLink>
    </div>

    <p class="text-muted small">
      Generá un link por cliente. Vas a ver cuándo lo abrió, cuántas veces y si tocó el botón de contacto.
    </p>

    <!-- Sin número cargado, el botón de contacto de sus propios links abre el
         WhatsApp de BairesRental. Es exactamente lo que un vendedor NO quiere
         y no hay forma de que se entere solo. -->
    <div v-if="!loading && !profile?.whatsapp" class="alert alert-warning py-2 small">
      Todavía no cargaste tu WhatsApp, así que el botón de contacto de tus links abre el de BairesRental.
      <NuxtLink to="/app/seller/profile">Cargalo en tu ficha →</NuxtLink>
    </div>

    <div v-if="feedback" class="alert py-2 small" :class="feedback.tone === 'success' ? 'alert-success' : 'alert-warning'">
      {{ feedback.text }}
    </div>

    <form class="card card-body mb-4" @submit.prevent="createLink">
      <div class="row g-2">
        <div class="col-12 col-sm-4">
          <label class="form-label small" for="lk-kind">¿Qué le mandás?</label>
          <select id="lk-kind" v-model="targetKind" class="form-select">
            <option value="rental">Un alquiler mío</option>
            <option value="sale">Una venta mía</option>
            <option value="catalog">Todo mi catálogo</option>
          </select>
        </div>
        <div v-if="targetKind !== 'catalog'" class="col-12 col-sm-8">
          <label class="form-label small" for="lk-prop">Publicación</label>
          <select id="lk-prop" v-model="selectedPropertyId" class="form-select" required>
            <option value="" disabled>Elegir publicación…</option>
            <option v-for="p in propertyChoices" :key="p.id" :value="p.id">{{ p.titulo }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-5">
          <label class="form-label small" for="lk-to">Para quién *</label>
          <input id="lk-to" v-model="recipientName" type="text" class="form-control" maxlength="80" placeholder="Juan Pérez" required />
        </div>
        <div class="col-12 col-sm-3">
          <label class="form-label small" for="lk-ch">Canal</label>
          <select id="lk-ch" v-model="channel" class="form-select">
            <option v-for="c in LINK_CHANNELS" :key="c" :value="c">{{ channelLabel(c) }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-4">
          <label class="form-label small" for="lk-note">Nota (opcional)</label>
          <input id="lk-note" v-model="note" type="text" class="form-control" maxlength="280" placeholder="busca desde marzo" />
        </div>
        <div class="col-12">
          <button type="submit" class="btn btn-primary" :disabled="creating || !canSubmit">
            {{ creating ? 'Generando…' : 'Generar y copiar link' }}
          </button>
        </div>
      </div>
    </form>

    <p v-if="loading">Cargando…</p>
    <div v-else-if="!links.length" class="br-app-empty">
      Todavía no generaste ningún link. Elegí una publicación, poné para quién es y compartilo.
    </div>

    <div v-else class="br-app-list">
      <article
        v-for="l in sortedLinks"
        :key="l.id"
        class="br-link-card"
        :class="{ 'is-inactive': l.active === false, 'is-saving': savingId === l.id }"
      >
        <div class="br-link-main">
          <div class="br-link-ident">
            <strong class="br-link-name">{{ l.recipientName || 'Sin etiquetar' }}</strong>
            <span class="br-link-chip">{{ channelLabel(l.channel) }}</span>
            <span v-if="l.active === false" class="br-link-chip is-off">Desactivado</span>
          </div>
          <div class="br-link-prop br-app-truncate">{{ propertyLabel(l) }}</div>
          <div v-if="l.note" class="br-link-note">{{ l.note }}</div>

          <!-- La cifra que importa es "visitantes": una apertura repetida es
               la misma persona volviendo a mirar, no interés nuevo. -->
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
          <select
            class="form-select form-select-sm br-link-outcome"
            :class="outcomeClass(l.outcome)"
            :disabled="savingId === l.id"
            :value="l.outcome || 'pending'"
            @change="setOutcome(l, ($event.target as HTMLSelectElement).value as LinkOutcome)"
          >
            <option v-for="o in LINK_OUTCOMES" :key="o" :value="o">{{ outcomeLabel(o) }}</option>
          </select>

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
              :title="openFor === l.id ? 'Ocultar actividad' : 'Ver actividad'"
              :aria-label="openFor === l.id ? 'Ocultar actividad' : 'Ver actividad'"
              @click="toggleActivity(l)"
            >
              <i class="bi bi-activity"></i>
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

        <div v-if="openFor === l.id" class="br-link-activity">
          <p v-if="loadingEvents" class="small text-muted mb-0">Cargando actividad…</p>
          <template v-else>
            <p class="small text-muted mb-2">
              {{ distinctVisitors(events[l.id] || []) }}
              {{ distinctVisitors(events[l.id] || []) === 1 ? 'visitante distinto' : 'visitantes distintos' }}
            </p>
            <ul class="br-link-events">
              <li v-for="(e, i) in humanEvents(l.id)" :key="i">
                <span class="br-link-event-when">{{ eventDateTime(e.at) }}</span>
                <span>{{ deviceLabel(e.device) }}</span>
                <span v-if="e.type === 'whatsapp'" class="is-good">tocó contacto</span>
                <span v-else-if="e.referer" class="text-muted">desde {{ refererHost(e.referer) }}</span>
              </li>
              <li v-if="!humanEvents(l.id).length" class="text-muted">Nadie lo abrió todavía.</li>
            </ul>

            <!-- Las vistas previas de las apps no cuentan como aperturas,
                 pero se guardan igual: si alguna vez el filtro se come gente
                 real, se ve acá en vez de desaparecer. -->
            <p v-if="botEvents(l.id).length" class="small text-muted mb-0">
              <button class="btn btn-link btn-sm p-0 align-baseline" @click="showBotsFor = showBotsFor === l.id ? null : l.id">
                + {{ botEvents(l.id).length }} vista(s) previa(s) de apps
              </button>
              <span v-if="showBotsFor === l.id" class="d-block mt-1">
                <span v-for="(e, i) in botEvents(l.id)" :key="i" class="d-block">
                  {{ eventDateTime(e.at) }} · {{ e.botName }}
                </span>
              </span>
            </p>
          </template>
        </div>
      </article>
    </div>
  </main>
</template>
