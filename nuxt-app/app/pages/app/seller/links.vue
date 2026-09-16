<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, where, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { LinkChannel, LinkOpenEvent, LinkOutcome, SellerProfile } from '~/types/link'
import { LINK_CHANNELS, LINK_OUTCOMES } from '~/types/link'
import {
  type LinkRow,
  channelLabel,
  linkLabel,
  outcomeLabel,
  outcomeClass,
  n,
  relativeTime,
  toMillis,
  useLinkUrl,
} from '~/composables/useLinkStats'

// La pantalla de links del vendedor.
//
// EL CAMBIO DE AHORA: el vendedor ya no tiene que generar nada para tener
// algo que mandar. Su cuenta viene con un link personal —creado por
// ensurePrimaryLink() en functions/src/index.ts apenas se crea el usuario—
// cuyo código es el slug de su nombre (/l/juan-perez) y que abre TODO el
// catálogo con su marca. Es el que va en la bio de Instagram, en la firma o
// en el estado de WhatsApp, y es lo primero que se ve acá arriba.
//
// Lo que antes era obligatorio para generar un link era "Para quién": el
// nombre del cliente al que se lo mandaba. O sea que no había forma de tener
// una URL sin inventar un destinatario, y las métricas de una misma
// publicación quedaban partidas en una fila por persona. Ahora el nombre es
// del LINK ("Todos los monoambientes", "Campaña de Instagram"), es opcional
// —si no lo ponen sale el título de la publicación— y el formulario quedó
// para lo único que el link personal no cubre: seguir aparte una publicación
// o una campaña.
//
// Lo de siempre, que no cambió:
//  · las aperturas las cuenta el servidor (server/middleware/01.link-open.ts);
//  · "visitantes" ≠ "aperturas": la misma persona abriendo tres veces es un
//    visitante, y eso es justo lo que el vendedor quiere saber;
//  · las vistas previas de WhatsApp/Instagram se cuentan aparte y se
//    muestran plegadas, para que no inflen el número;
//  · la query de `links` es inline filtrada por sellerUid (lo exige
//    firestore.rules) y el orden se hace del lado del cliente, misma
//    convención que leads.vue — no agregar orderBy, haría falta un índice
//    compuesto.
//
// El SELECTOR DE PUBLICACIÓN ofrece el catálogo entero: el de BairesRental,
// lo del vendedor y también las exclusivas de sus colegas. Lo decide
// `isShareableBySeller()` (app/utils/sellerScope.ts) y lo vuelve a validar
// el callable `createTrackableLink` del lado del servidor.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mis links', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const { linkUrl } = useLinkUrl()

type RentalRow = RentalProperty & { id: string; sellerUid?: string | null }
type SaleRow = SaleProperty & { id: string; sellerUid?: string | null }

const links = ref<LinkRow[]>([])
const rentals = ref<RentalRow[]>([])
const sales = ref<SaleRow[]>([])
const profile = ref<SellerProfile | null>(null)
const loading = ref(true)
const ensuring = ref(false)
const creating = ref(false)
const copiedCode = ref<string | null>(null)
const savingId = ref<string | null>(null)
const feedback = ref<{ text: string; tone: 'success' | 'warning' } | null>(null)

// Actividad por link, cargada recién cuando se despliega una fila: son N
// lecturas por link y casi siempre mirás uno solo.
const openFor = ref<string | null>(null)
const events = ref<Record<string, LinkOpenEvent[]>>({})
const loadingEvents = ref(false)

const targetKind = ref<'rental' | 'sale' | 'catalog'>('rental')
const selectedPropertyId = ref('')
const linkName = ref('')
const channel = ref<LinkChannel>('whatsapp')
const note = ref('')

const propertyChoices = computed<(RentalRow | SaleRow)[]>(() =>
  targetKind.value === 'sale' ? sales.value : rentals.value,
)
const ownChoices = computed(() => propertyChoices.value.filter((p) => isOwnListing(p, user.value?.uid)))
const restChoices = computed(() => propertyChoices.value.filter((p) => !isOwnListing(p, user.value?.uid)))

// El botón "compartir" de /app/seller/listings llega acá con la publicación
// ya elegida y el foco puesto en el nombre del link.
const route = useRoute()
if (route.query.kind === 'rental' || route.query.kind === 'sale') {
  targetKind.value = route.query.kind
  selectedPropertyId.value = (route.query.prop as string) || ''
}

// El link personal se muestra aparte, arriba de todo: no es uno más de la
// lista y no se desactiva ni se reemplaza.
const primaryLink = computed(() => links.value.find((l) => l.primary) ?? null)
const extraLinks = computed(() =>
  links.value
    .filter((l) => !l.primary)
    .sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0)),
)

async function loadLinks() {
  const uid = user.value?.uid
  if (!uid) return
  const snap = await getDocs(query(collection(useFirestore(), 'links'), where('sellerUid', '==', uid)))
  links.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LinkRow, 'id'>) }))
}

// Remiendo para las cuentas anteriores a que el link personal fuera
// automático: se pide sólo si la lista que acabamos de leer no lo trae, así
// que en una cuenta creada después de este cambio no se llama nunca.
async function ensurePrimary() {
  ensuring.value = true
  try {
    await callable<{ uid?: string }, { code: string }>('ensureSellerLink')({})
    await loadLinks()
  } catch (err) {
    feedback.value = { text: (err as Error).message, tone: 'warning' }
  } finally {
    ensuring.value = false
  }
}

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    const [r, s, p] = await Promise.all([
      listAll<RentalRow>('rentals'),
      listAll<SaleRow>('sales'),
      getDoc(doc(useFirestore(), 'sellerProfiles', uid)),
    ])
    rentals.value = r.filter((x) => isShareableBySeller(x, uid)).sort(ownFirst(uid))
    sales.value = s.filter((x) => isShareableBySeller(x, uid)).sort(ownFirst(uid))
    profile.value = p.exists() ? (p.data() as SellerProfile) : null
    await loadLinks()
    if (!primaryLink.value) await ensurePrimary()
  }
  loading.value = false
})

async function createLink() {
  if (!canSubmit.value) return
  creating.value = true
  feedback.value = null
  try {
    const fn = callable<Record<string, unknown>, { code: string; existing: boolean }>('createTrackableLink')
    const res = await fn({
      target: targetKind.value === 'catalog' ? 'catalog' : 'property',
      propertyId: targetKind.value === 'catalog' ? null : selectedPropertyId.value,
      propertyType: targetKind.value === 'catalog' ? null : targetKind.value,
      label: linkName.value.trim() || null,
      channel: channel.value,
      note: note.value.trim() || null,
    })
    await loadLinks()
    // La función es idempotente: pedir dos veces el mismo link devuelve el
    // que ya existía. Decirlo evita que el vendedor piense que no funcionó y
    // siga tocando el botón.
    feedback.value = res.data.existing
      ? { text: 'Ese link ya lo tenías generado: es el mismo, y ya está copiado.', tone: 'success' }
      : { text: 'Link generado y copiado. Mandáselo.', tone: 'success' }
    await copyLink(res.data.code)
    linkName.value = ''
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

function propertyLabel(link: LinkRow) {
  if (link.target === 'catalog' || !link.propertyId) return 'Todo el catálogo'
  if (link.propertyTitulo) return link.propertyTitulo
  const list = link.propertyType === 'rental' ? rentals.value : sales.value
  return list.find((p) => p.id === link.propertyId)?.titulo || link.propertyId
}

const canSubmit = computed(() => targetKind.value === 'catalog' || !!selectedPropertyId.value)
</script>

<template>
  <main class="container py-4" style="max-width: 900px">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Mis links</h1>
      <NuxtLink to="/app/seller/profile" class="btn btn-sm btn-outline-secondary">Mi ficha</NuxtLink>
    </div>

    <!-- Sin número cargado, el botón de contacto de sus links abre el
         WhatsApp de BairesRental. Es exactamente lo que un vendedor NO quiere
         y no hay forma de que se entere solo. -->
    <div v-if="!loading && !profile?.whatsapp" class="alert alert-warning py-2 small">
      Todavía no cargaste tu WhatsApp, así que el botón de contacto de tus links abre el de BairesRental.
      <NuxtLink to="/app/seller/profile">Cargalo en tu ficha →</NuxtLink>
    </div>

    <div v-if="feedback" class="alert py-2 small" :class="feedback.tone === 'success' ? 'alert-success' : 'alert-warning'">
      {{ feedback.text }}
    </div>

    <!-- 1. El link personal. Ya existe: acá no se genera nada, se copia. -->
    <section v-if="primaryLink" class="br-my-link">
      <div class="br-my-link-head">
        <h2 class="h6 mb-0">Tu link</h2>
        <span class="br-link-chip">Todo el catálogo</span>
        <!-- No debería pasar —ni la UI ni las reglas lo permiten— pero un
             link apagado devuelve 410 y el vendedor no tendría cómo
             enterarse: lo seguiría mandando. -->
        <span v-if="primaryLink.active === false" class="br-link-chip is-off">Desactivado</span>
      </div>
      <p class="br-my-link-lead">
        Se creó solo con tu cuenta y no cambia. Abre el catálogo completo con tu nombre y tu WhatsApp: ponelo en tu bio
        de Instagram, en tu estado de WhatsApp o mandáselo a quien te consulte.
      </p>

      <div class="br-my-link-url">
        <code class="br-app-truncate">{{ linkUrl(primaryLink.id) }}</code>
        <div class="br-my-link-btns">
          <button class="btn btn-primary btn-sm" @click="copyLink(primaryLink.id)">
            <i :class="copiedCode === primaryLink.id ? 'bi bi-clipboard-check' : 'bi bi-clipboard'"></i>
            {{ copiedCode === primaryLink.id ? 'Copiado' : 'Copiar' }}
          </button>
          <a :href="linkUrl(primaryLink.id)" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-box-arrow-up-right"></i> Abrir
          </a>
          <button
            class="btn btn-sm btn-outline-secondary"
            :aria-expanded="openFor === primaryLink.id"
            @click="toggleActivity(primaryLink)"
          >
            <i class="bi bi-activity"></i> {{ openFor === primaryLink.id ? 'Ocultar actividad' : 'Ver actividad' }}
          </button>
        </div>
      </div>

      <div class="br-link-stats">
        <span :class="{ 'is-zero': n(primaryLink.opens) === 0 }">
          <strong>{{ n(primaryLink.opens) }}</strong> {{ n(primaryLink.opens) === 1 ? 'apertura' : 'aperturas' }}
        </span>
        <span v-if="n(primaryLink.whatsappClicks) > 0" class="is-good">
          <strong>{{ n(primaryLink.whatsappClicks) }}</strong>
          contacto{{ n(primaryLink.whatsappClicks) === 1 ? '' : 's' }}
        </span>
        <span class="br-link-when">{{ n(primaryLink.opens) ? relativeTime(primaryLink.lastOpenAt) : 'sin abrir' }}</span>
      </div>

      <LinkActivity
        v-if="openFor === primaryLink.id"
        :events="events[primaryLink.id] || []"
        :loading="loadingEvents"
      />
    </section>

    <p v-else-if="loading || ensuring" class="text-muted">Preparando tu link…</p>

    <!-- 2. Los links extra: una publicación puntual, o una campaña. -->
    <h2 class="h6 mt-4 mb-1">Links aparte</h2>
    <p class="text-muted small">
      Para seguir por separado una publicación o una campaña. Ponele un nombre y después vas a ver, en esa fila, cuántas
      veces la abrieron y si tocaron contacto.
    </p>

    <form class="card card-body mb-4" @submit.prevent="createLink">
      <div class="row g-2">
        <div class="col-12 col-sm-4">
          <label class="form-label small" for="lk-kind">¿Qué compartís?</label>
          <select id="lk-kind" v-model="targetKind" class="form-select">
            <option value="rental">Un alquiler</option>
            <option value="sale">Una venta</option>
            <option value="catalog">Todo el catálogo</option>
          </select>
        </div>
        <div v-if="targetKind !== 'catalog'" class="col-12 col-sm-8">
          <label class="form-label small" for="lk-prop">Publicación</label>
          <select id="lk-prop" v-model="selectedPropertyId" class="form-select" required>
            <option value="" disabled>Elegir publicación…</option>
            <optgroup v-if="ownChoices.length" label="Mis publicaciones">
              <option v-for="p in ownChoices" :key="p.id" :value="p.id">{{ p.titulo }}</option>
            </optgroup>
            <optgroup v-if="restChoices.length" label="Resto del catálogo">
              <option v-for="p in restChoices" :key="p.id" :value="p.id">{{ p.titulo }}</option>
            </optgroup>
          </select>
        </div>
        <div class="col-12 col-sm-5">
          <label class="form-label small" for="lk-name">Nombre del link <span class="text-muted">(opcional)</span></label>
          <input
            id="lk-name"
            v-model="linkName"
            type="text"
            class="form-control"
            maxlength="80"
            placeholder="Todos los monoambientes"
          />
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
    <div v-else-if="!extraLinks.length" class="br-app-empty">
      Todavía no generaste ningún link aparte. Con el de arriba ya podés compartir todo el catálogo.
    </div>

    <div v-else class="br-app-list">
      <article
        v-for="l in extraLinks"
        :key="l.id"
        class="br-link-card"
        :class="{ 'is-inactive': l.active === false, 'is-saving': savingId === l.id }"
      >
        <div class="br-link-main">
          <div class="br-link-ident">
            <strong class="br-link-name">{{ linkLabel(l) }}</strong>
            <span v-if="l.channel" class="br-link-chip">{{ channelLabel(l.channel) }}</span>
            <span v-if="l.active === false" class="br-link-chip is-off">Desactivado</span>
          </div>
          <div class="br-link-prop br-app-truncate">{{ propertyLabel(l) }}</div>
          <!-- El código dejó de ser ab3f9k: cuelga del nombre del vendedor y
               del nombre del link, así que la URL dice sola de qué es esta
               fila y se puede dictar por teléfono. Mostrarla es gratis. -->
          <code class="br-link-url br-app-truncate">{{ linkUrl(l.id) }}</code>
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

        <LinkActivity v-if="openFor === l.id" :events="events[l.id] || []" :loading="loadingEvents" />
      </article>
    </div>
  </main>
</template>
