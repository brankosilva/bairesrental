<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { RentalRow, SaleRow } from '~/types/property'
import type { Availability, PropertyKind } from '~/utils/availability'
import { revisionDe } from '~/utils/revision'

// Las propiedades que puede trabajar un vendedor.
//
// ANTES: `listBySeller()` sobre las dos colecciones, o sea sólo lo que había
// cargado él. Como el catálogo lo carga el admin y ningún documento de
// `rentals`/`sales` tiene `sellerUid`, esta pantalla le mostraba CERO
// propiedades a todo el mundo. Ahora lista todo el catálogo de BairesRental
// más lo propio — ver `isShareableBySeller()` en app/utils/sellerScope.ts, que
// es también la regla que aplican el callable de links y /l/:code.
//
// Lo de BairesRental entra en SÓLO LECTURA: se comparte pero no se edita ni se
// le cambia la disponibilidad (`firestore.rules` rechazaría el update igual, y
// ofrecer un <select> que falla es peor que no ofrecerlo).
//
// Son dos colecciones con opciones de disponibilidad distintas ("no
// disponible" vs "vendido"), así que hay dos instancias de todo — de
// useAvailability y de usePropertyFilters — y una tira de pestañas para elegir
// cuál se está mirando. Con 85 alquileres, las dos listas juntas y sin filtros
// (que es lo que había) no se pueden recorrer.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Propiedades', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const user = useCurrentUser()
const uid = computed(() => user.value?.uid ?? null)

const rentals = ref<RentalRow[]>([])
const sales = ref<SaleRow[]>([])
const loading = ref(true)
// Arranca en la pestaña de lo que se acaba de guardar, si se viene de un
// formulario (?kind=…, ver useJustSaved()).
const kind = ref<PropertyKind>(route.query.kind === 'sale' ? 'sale' : 'rental')

const {
  savingId: savingRentalId,
  notice: rentalNotice,
  setAvailability: setRentalAvailability,
} = useAvailability('rentals')

const {
  savingId: savingSaleId,
  notice: saleNotice,
  setAvailability: setSaleAvailability,
} = useAvailability('sales')

const notice = computed(() => rentalNotice.value ?? saleNotice.value)

function clearNotice() {
  rentalNotice.value = null
  saleNotice.value = null
}

// Dos juegos de filtros con nombres distintos y no un `computed` que devuelva
// el que corresponde: los refs que salen de un computed NO se desenvuelven en
// el template, así que `v-model:search="filtros.search"` bindearía el Ref.
const {
  search: rSearch,
  tipos: rTipos,
  disponibilidad: rDisponibilidad,
  propio: rPropio,
  tipoOptions: rTipoOptions,
  availabilityOptions: rAvailabilityOptions,
  matches: rMatches,
  activeCount: rActiveCount,
  clear: rClear,
} = usePropertyFilters<RentalRow>('rental', rentals)

const {
  search: sSearch,
  tipos: sTipos,
  disponibilidad: sDisponibilidad,
  propio: sPropio,
  tipoOptions: sTipoOptions,
  availabilityOptions: sAvailabilityOptions,
  matches: sMatches,
  activeCount: sActiveCount,
  clear: sClear,
} = usePropertyFilters<SaleRow>('sale', sales)

// Cartel de "listo, se guardó" + la recién guardada primera de su lista. Cada
// instancia sólo reacciona a lo suyo: la query trae el `kind`. Ver useJustSaved().
const {
  savedId: rSavedId,
  isNew: rSavedIsNew,
  saved: rSaved,
  savedFirst: rSavedFirst,
  close: rCloseSaved,
} = useJustSaved(rentals, 'rental')

const {
  savedId: sSavedId,
  isNew: sSavedIsNew,
  saved: sSaved,
  savedFirst: sSavedFirst,
  close: sCloseSaved,
} = useJustSaved(sales, 'sale')

onMounted(async () => {
  // listAll() y no listBySeller(): las reglas le dan a cualquier usuario
  // logueado lectura de las dos colecciones enteras (el recorte público por
  // `revision` sólo le pega a los anónimos), y qué se muestra lo decide el
  // filtro de abajo.
  const [r, s] = await Promise.all([listAll<RentalRow>('rentals'), listAll<SaleRow>('sales')])
  // El `|| isOwnListing()` es la excepción a isShareableBySeller(), que desde
  // la revisión deja afuera lo que todavía no aprobó un admin. Sin él, la
  // propiedad que el vendedor acaba de cargar desaparece de su propio panel
  // apenas la guarda: no la puede ver, ni corregir, ni leer por qué se la
  // rechazaron — que son justamente las únicas que necesita mirar.
  // Compartirla sigue sin poder: eso lo decide isShareableBySeller().
  const visible = (p: RentalRow | SaleRow) => isShareableBySeller(p, uid.value) || isOwnListing(p, uid.value)
  rentals.value = r.filter(visible).sort(ownFirst(uid.value))
  sales.value = s.filter(visible).sort(ownFirst(uid.value))
  loading.value = false
})

const filteredRentals = computed(() => rentals.value.filter(rMatches).sort(rSavedFirst))
const filteredSales = computed(() => sales.value.filter(sMatches).sort(sSavedFirst))

function mine(p: { sellerUid?: string | null }) {
  return isOwnListing(p, uid.value)
}

// A propósito NO dice "gestiona BairesRental" como en las listas de admin: el
// filtro "Gestión" de la toolbar es `esPropio` —si la administra BairesRental o
// un colega— y son dos cosas distintas. Acá lo que el vendedor necesita saber
// es otra: cuál puede tocar y, si no es suya, de quién es.
//
// El nombre sale de `sellerNombre`, desnormalizado en el documento: las reglas
// no le dan a un vendedor lectura sobre el `users/{uid}` de otro, así que no
// hay forma de resolverlo con una consulta.
function originLabel(p: RentalRow | SaleRow) {
  if (mine(p)) return '★ mía'
  if (p.sellerNombre) return `de ${p.sellerNombre} · sólo lectura`
  return 'sólo lectura'
}

// Una publicación en revisión todavía no se puede compartir: el link existiría
// pero /l/:code le contestaría 404 al cliente. Mejor no ofrecer el botón.
function canShare(p: RentalRow | SaleRow) {
  return revisionDe(p) === 'aprobada'
}

// A dónde manda el botón de ficha: siempre la ficha pública de BairesRental
// (no el link de Airbnb/Booking ni el álbum de ficha.info que sí usan las
// listas de admin) — es lo que el vendedor comparte con el cliente.
//
// Sólo vale si está aprobada: la de una publicación que todavía está en
// revisión no existe para el público y daría 404.
function fichaRentalHref(r: RentalRow): string {
  return canShare(r) ? `/departamentos/${r.id}` : ''
}

function fichaSaleHref(s: SaleRow): string {
  return canShare(s) ? `/ventas/${s.id}` : ''
}

// Prellenado del formulario de /app/seller/links. No genera el link de una
// porque ahí se le pone nombre, canal y nota: se llega al formulario con la
// publicación ya elegida. Para compartir el catálogo entero no hace falta
// pasar por acá — el link personal del vendedor ya lo hace.
function shareTo(id: string, k: PropertyKind) {
  return `/app/seller/links?kind=${k}&prop=${encodeURIComponent(id)}`
}
</script>

<template>
  <main class="container py-4">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Propiedades</h1>
      <div class="d-flex gap-2">
        <NuxtLink to="/app/rentals/new" class="btn btn-primary">+ Alquiler</NuxtLink>
        <NuxtLink to="/app/sales/new" class="btn btn-primary">+ Venta</NuxtLink>
      </div>
    </div>

    <p class="text-muted small mb-2">
      El catálogo completo: el de BairesRental, las tuyas y las que cargaron tus colegas. Con
      <i class="bi bi-box-arrow-up-right"></i> abrís la ficha con las fotos y con
      <i class="bi bi-link-45deg"></i> generás el link de una publicación con tu nombre y tu WhatsApp; las que no son
      tuyas las compartís igual, pero las edita quien las cargó.
    </p>
    <p class="text-muted small mb-2">
      Lo que cargás pasa por una revisión antes de salir al sitio: queda <em>en revisión</em> hasta que un admin la
      aprueba, y mientras tanto la ves sólo vos, acá. Si te la rechazan vas a ver el motivo en la fila.
    </p>

    <div class="br-app-filters" role="tablist" aria-label="Tipo de operación">
      <button
        type="button"
        role="tab"
        class="br-app-pill"
        :class="{ active: kind === 'rental' }"
        :aria-selected="kind === 'rental'"
        @click="kind = 'rental'"
      >
        Alquileres ({{ rentals.length }})
      </button>
      <button
        type="button"
        role="tab"
        class="br-app-pill"
        :class="{ active: kind === 'sale' }"
        :aria-selected="kind === 'sale'"
        @click="kind = 'sale'"
      >
        Ventas ({{ sales.length }})
      </button>
    </div>

    <AdminPropertyFilters
      v-if="kind === 'rental'"
      v-model:search="rSearch"
      v-model:tipos="rTipos"
      v-model:disponibilidad="rDisponibilidad"
      v-model:propio="rPropio"
      :tipo-options="rTipoOptions"
      :availability-options="rAvailabilityOptions"
      :active-count="rActiveCount"
      @clear="rClear"
    />
    <AdminPropertyFilters
      v-else
      v-model:search="sSearch"
      v-model:tipos="sTipos"
      v-model:disponibilidad="sDisponibilidad"
      v-model:propio="sPropio"
      :tipo-options="sTipoOptions"
      :availability-options="sAvailabilityOptions"
      :active-count="sActiveCount"
      @clear="sClear"
    />

    <SavedPropertyNotice
      v-if="rSaved"
      kind="rental"
      :id="rSaved.id"
      :titulo="rSaved.titulo"
      :is-new="rSavedIsNew"
      :en-revision="revisionDe(rSaved) !== 'aprobada'"
      @close="rCloseSaved"
    />
    <SavedPropertyNotice
      v-if="sSaved"
      kind="sale"
      :id="sSaved.id"
      :titulo="sSaved.titulo"
      :is-new="sSavedIsNew"
      :en-revision="revisionDe(sSaved) !== 'aprobada'"
      @close="sCloseSaved"
    />

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

    <template v-else-if="kind === 'rental'">
      <div v-if="filteredRentals.length" class="br-app-list">
        <PropertyAdminCard
          v-for="r in filteredRentals"
          :id="r.id"
          :key="r.id"
          kind="rental"
          :titulo="r.titulo"
          :barrio="r.barrio"
          :tipo="r.tipo"
          :precio="r.precio"
          :moneda="r.moneda"
          :disponibilidad="r.disponibilidad"
          :thumb="r.imagen"
          :ficha-to="fichaRentalHref(r)"
          :edit-to="mine(r) ? `/app/rentals/${r.id}` : ''"
          :share-to="canShare(r) ? shareTo(r.id, 'rental') : ''"
          :extra="originLabel(r)"
          :revision="revisionDe(r)"
          :motivo-rechazo="r.motivoRechazo"
          :highlight="r.id === rSavedId"
          :status-readonly="!mine(r)"
          :saving="savingRentalId === r.id"
          @change="(v: Availability) => setRentalAvailability(r, v)"
        />
      </div>
      <p v-else-if="rActiveCount" class="br-app-empty">Ningún alquiler coincide con los filtros.</p>
      <p v-else class="br-app-empty">Todavía no hay alquileres en el catálogo.</p>
    </template>

    <template v-else>
      <div v-if="filteredSales.length" class="br-app-list">
        <PropertyAdminCard
          v-for="s in filteredSales"
          :id="s.id"
          :key="s.id"
          kind="sale"
          :titulo="s.titulo"
          :barrio="s.barrio"
          :tipo="s.tipo"
          :precio="s.precio"
          :moneda="s.moneda"
          :disponibilidad="s.disponibilidad"
          :thumb="s.fotos?.[0] || ''"
          :ficha-to="fichaSaleHref(s)"
          :edit-to="mine(s) ? `/app/sales/${s.id}` : ''"
          :share-to="canShare(s) ? shareTo(s.id, 'sale') : ''"
          :extra="originLabel(s)"
          :revision="revisionDe(s)"
          :motivo-rechazo="s.motivoRechazo"
          :highlight="s.id === sSavedId"
          :status-readonly="!mine(s)"
          :saving="savingSaleId === s.id"
          @change="(v: Availability) => setSaleAvailability(s, v)"
        />
      </div>
      <p v-else-if="sActiveCount" class="br-app-empty">Ninguna venta coincide con los filtros.</p>
      <p v-else class="br-app-empty">Todavía no hay ventas en el catálogo.</p>
    </template>
  </main>
</template>
