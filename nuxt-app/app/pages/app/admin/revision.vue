<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { RentalRow, SaleRow } from '~/types/property'
import { revisionDe } from '~/utils/revision'

// La cola de revisión: lo que cargó un vendedor y todavía no salió al sitio.
//
// Las dos colecciones en UNA sola lista, y no dos pestañas como en
// seller/listings: acá el eje no es "alquiler o venta" sino "qué falta
// revisar", y la cola normal es de unas pocas filas. Partirla en dos esconde
// la mitad del trabajo detrás de una pestaña que nadie mira.
//
// Ordenada por `updatedAt` en el cliente, que es la convención del proyecto
// (firestore.indexes.json está vacío a propósito: nadie hace índices
// compuestos). `updatedAt` lo sella adminCrud y para una cola significa
// exactamente lo que hace falta: cuándo la mandaron.
//
// NO usa <PropertyAdminCard>: esa card tiene la columna de acciones fijada en
// dos botones y su <select> es el de disponibilidad, que es otro eje. Acá cada
// fila necesita Aprobar, Rechazar y un <textarea> de motivo.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin'] })
useHead({ title: 'BairesRental — Admin · Revisión', meta: [{ name: 'robots', content: 'noindex' }] })

type Row = (RentalRow | SaleRow) & { kind: 'rental' | 'sale' }

interface UserDoc {
  id: string
  email?: string | null
  displayName?: string | null
}

const me = useCurrentUser()
const rentals = ref<RentalRow[]>([])
const sales = ref<SaleRow[]>([])
const users = ref<UserDoc[]>([])
const loading = ref(true)

const { savingId: savingRentalId, notice: rentalNotice, setRevision: setRentalRevision } = useRevision('rentals')
const { savingId: savingSaleId, notice: saleNotice, setRevision: setSaleRevision } = useRevision('sales')

const notice = computed(() => rentalNotice.value ?? saleNotice.value)
const savingId = computed(() => savingRentalId.value ?? savingSaleId.value)

function clearNotice() {
  rentalNotice.value = null
  saleNotice.value = null
}

// El <textarea> abierto y su texto, por fila. Se guarda por id y no en la fila
// para no ensuciar el objeto que después se escribe a Firestore.
const rechazando = ref<string | null>(null)
const motivos = ref<Record<string, string>>({})

onMounted(async () => {
  // listAll() y no una query por `revision`: un admin lee todo igual (las
  // reglas se lo permiten) y así las rechazadas siguen a mano sin una segunda
  // consulta. Son ~88 documentos, los mismos que ya lee admin/rentals.
  const [r, s, u] = await Promise.all([
    listAll<RentalRow>('rentals'),
    listAll<SaleRow>('sales'),
    listAll<UserDoc>('users'),
  ])
  rentals.value = r
  sales.value = s
  users.value = u
  loading.value = false
})

// Quién la cargó, con nombre y mail de verdad. El documento sólo lleva
// `sellerNombre` desnormalizado (`users` no lo puede leer un vendedor), pero el
// admin sí puede leer `users`, así que acá se muestra el dato completo y al día
// —si alguien se cambió el nombre, vale el de `users`, no el congelado—.
function seller(p: RentalRow | SaleRow): string {
  if (!p.sellerUid) return 'BairesRental'
  const u = users.value.find((x) => x.id === p.sellerUid)
  const nombre = u?.displayName || p.sellerNombre || null
  const email = u?.email || null
  if (nombre && email) return `${nombre} · ${email}`
  return nombre || email || `uid ${p.sellerUid.slice(0, 8)}…`
}

function ms(p: RentalRow | SaleRow): number {
  const ts = p.updatedAt as { seconds?: number } | undefined
  return ts?.seconds ? ts.seconds * 1000 : 0
}

// La más vieja primero: es una cola, el que más esperó va adelante.
const pendientes = computed<Row[]>(() =>
  [
    ...rentals.value.filter((p) => revisionDe(p) === 'pendiente').map((p) => ({ ...p, kind: 'rental' as const })),
    ...sales.value.filter((p) => revisionDe(p) === 'pendiente').map((p) => ({ ...p, kind: 'sale' as const })),
  ].sort((a, b) => ms(a) - ms(b)),
)

const rechazadas = computed<Row[]>(() =>
  [
    ...rentals.value.filter((p) => revisionDe(p) === 'rechazada').map((p) => ({ ...p, kind: 'rental' as const })),
    ...sales.value.filter((p) => revisionDe(p) === 'rechazada').map((p) => ({ ...p, kind: 'sale' as const })),
  ].sort((a, b) => ms(b) - ms(a)),
)

function thumb(p: Row): string {
  return p.kind === 'rental' ? (p as RentalRow).imagen || '' : (p as SaleRow).fotos?.[0] || ''
}

function fichaHref(p: Row): string {
  return p.kind === 'rental' ? `/departamentos/${p.id}` : `/ventas/${p.id}`
}

function editHref(p: Row): string {
  return p.kind === 'rental' ? `/app/rentals/${p.id}` : `/app/sales/${p.id}`
}

// La fila de `pendientes`/`rechazadas` es una COPIA (el `...p` del map), así que
// escribirle el estado ahí no se vería: hay que tocar el objeto de la lista
// original, que es el que alimenta los computed.
function original(p: Row): RentalRow | SaleRow | undefined {
  const lista = p.kind === 'rental' ? rentals.value : sales.value
  return lista.find((x) => x.id === p.id)
}

// Un if/else y no `const set = cond ? a : b`: con el ternario, TypeScript arma
// la UNIÓN de las dos firmas genéricas y después no la puede llamar (el
// parámetro le queda como intersección de RentalRow y SaleRow). Cada rama tiene
// su propia instancia de useRevision porque son dos colecciones distintas.
async function revisar(p: Row, estado: 'aprobada' | 'rechazada', motivo: string | null): Promise<boolean> {
  const target = original(p)
  if (!target) return false
  const por = me.value?.uid ?? null
  return p.kind === 'rental'
    ? setRentalRevision(target as RentalRow, estado, motivo, por)
    : setSaleRevision(target as SaleRow, estado, motivo, por)
}

async function aprobar(p: Row) {
  await revisar(p, 'aprobada', null)
}

async function rechazar(p: Row) {
  const motivo = (motivos.value[p.id] || '').trim()
  if (!motivo) return
  if (await revisar(p, 'rechazada', motivo)) {
    rechazando.value = null
    delete motivos.value[p.id]
  }
}

function abrirRechazo(p: Row) {
  rechazando.value = rechazando.value === p.id ? null : p.id
}
</script>

<template>
  <main class="container py-4">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Revisión ({{ pendientes.length }})</h1>
    </div>

    <p class="text-muted small mb-3">
      Lo que cargaron los vendedores y todavía no está en el sitio. Aprobala y sale publicada al instante;
      rechazala con un motivo y el vendedor lo ve en su panel para corregirla y volver a mandarla.
    </p>

    <div
      v-if="notice"
      class="alert br-app-notice d-flex align-items-start gap-2"
      :class="notice.tone === 'danger' ? 'alert-warning' : 'alert-info'"
      role="alert"
    >
      <div class="small flex-grow-1">{{ notice.text }}</div>
      <button type="button" class="btn-close flex-shrink-0" aria-label="Cerrar" @click="clearNotice"></button>
    </div>

    <p v-if="loading">Cargando…</p>

    <template v-else>
      <div v-if="pendientes.length" class="br-app-list">
        <div v-for="p in pendientes" :key="`${p.kind}-${p.id}`" class="br-review-card">
          <div class="br-review-main">
            <div class="br-app-card-thumb">
              <img v-if="thumb(p)" :src="thumb(p)" :alt="p.titulo" loading="lazy" />
              <span v-else aria-hidden="true">📸</span>
            </div>

            <div class="br-app-card-info">
              <div class="br-app-card-titulo">{{ p.titulo }}</div>
              <div class="br-app-card-meta">
                {{ p.barrio }} · {{ p.tipo }} · {{ p.kind === 'rental' ? 'alquiler' : 'venta' }}
              </div>
              <div class="br-app-card-id">{{ p.id }}</div>
              <div class="br-review-seller">Cargada por {{ seller(p) }}</div>
            </div>

            <div class="br-review-actions">
              <a
                :href="fichaHref(p)"
                target="_blank"
                rel="noopener"
                class="btn btn-outline-secondary btn-sm"
                title="Ver la ficha como la vería un cliente"
              >
                Ver ficha
              </a>
              <NuxtLink :to="editHref(p)" class="btn btn-outline-secondary btn-sm">Editar</NuxtLink>
              <button
                type="button"
                class="btn btn-outline-danger btn-sm"
                :disabled="savingId === p.id"
                @click="abrirRechazo(p)"
              >
                Rechazar
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="savingId === p.id"
                @click="aprobar(p)"
              >
                {{ savingId === p.id ? 'Guardando…' : 'Aprobar' }}
              </button>
            </div>
          </div>

          <div v-if="rechazando === p.id" class="br-review-motivo">
            <label :for="`motivo-${p.id}`" class="form-label small mb-1">
              ¿Qué tiene que corregir? Lo va a ver tal cual en su panel.
            </label>
            <textarea
              :id="`motivo-${p.id}`"
              v-model="motivos[p.id]"
              class="form-control"
              rows="2"
              placeholder="Ej: las fotos no corresponden al departamento, y falta la dirección."
            ></textarea>
            <div class="d-flex gap-2 mt-2">
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="!(motivos[p.id] || '').trim() || savingId === p.id"
                @click="rechazar(p)"
              >
                Rechazar
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="rechazando = null">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <p v-else class="br-app-empty">No hay nada esperando revisión. 🎉</p>

      <template v-if="rechazadas.length">
        <h2 class="h6 mt-4 mb-2 text-muted">Rechazadas ({{ rechazadas.length }})</h2>
        <p class="text-muted small mb-2">
          Esperando que el vendedor las corrija. Cuando las vuelva a guardar, aparecen arriba.
        </p>
        <div class="br-app-list">
          <PropertyAdminCard
            v-for="p in rechazadas"
            :id="p.id"
            :key="`${p.kind}-${p.id}`"
            :kind="p.kind"
            :titulo="p.titulo"
            :barrio="p.barrio"
            :tipo="p.tipo"
            :precio="p.precio"
            :moneda="p.moneda"
            :disponibilidad="p.disponibilidad"
            :thumb="thumb(p)"
            :edit-to="editHref(p)"
            :extra="seller(p)"
            :revision="revisionDe(p)"
            :motivo-rechazo="p.motivoRechazo"
            status-readonly
          />
        </div>
      </template>
    </template>
  </main>
</template>
