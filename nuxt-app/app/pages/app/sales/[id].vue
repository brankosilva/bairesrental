<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AMENITY_EMOJI } from '~/utils/amenities'
import { DuplicateIdError } from '~/utils/adminCrud'
import type { SaleProperty, SaleRow, OrigenImport } from '~/types/property'
import { revisionDe, type EstadoRevision } from '~/utils/revision'
import { resolverPin } from '~/utils/pin'

interface SellerOption {
  id: string
  email: string | null
  displayName?: string | null
}

// Ported from app/src/pages/app/SaleForm.vue — see rentals/[id].vue's
// sibling comment for the shared conventions (id === 'new', image upload
// via storageUpload.ts's uploadPropertyImage()).
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin', 'seller'] })
useHead({ title: 'BairesRental — Editar venta', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const user = useCurrentUser()

const id = route.params.id as string
const isNew = id === 'new'
const loading = ref(!isNew)
const saving = ref(false)
// Qué está pasando mientras `saving` está en true. Esta pantalla sube hasta 20
// fotos EN SERIE detrás de un solo booleano: con el texto fijo "Guardando…",
// en datos móviles eran minutos de un botón que parecía colgado, sin ninguna
// señal de que estaba avanzando.
const savingNote = ref('')
const notFound = ref(false)
// Ver rentals/[id].vue: el id lo tipea una persona y no se cambia después.
// Acá importa todavía más — si el alta falla recién en el submit, ya se
// subieron las fotos.
const idError = ref('')
// Lo que el `required` del navegador no puede chequear solo: la galería, que
// mezcla lo ya guardado con lo que está por subirse.
const formError = ref('')
const newFiles = ref<File[]>([])
// Fotos que se agregan pegando un link en vez de subiendo el archivo. Al
// guardar, `importListingImage` las baja y las deja en nuestro Storage — la
// galería nunca apunta al CDN de otro.
const newUrls = ref<string[]>([])
const urlDraft = ref('')
const role = ref<string | null>(null)
const saveError = ref('')

const MAX_FOTOS = 20
const TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH']
const AMENITIES = Object.keys(AMENITY_EMOJI)

// lat/lng salen del Omit para poder arrancar en null y no en undefined:
// Firestore rechaza el undefined y el formulario los escribe siempre, aunque
// no se haya podido ubicar la dirección (ver PropertyLocationFields.vue).
const form = reactive<
  Omit<SaleProperty, 'id' | 'lat' | 'lng'> & {
    id: string
    lat: number | null
    lng: number | null
    sellerUid: string | null
    sellerNombre: string | null
    ownerUid: string | null
    propietarioNombre: string | null
    propietarioContacto: string | null
    // De qué ficha salió. No se edita: se reenvía tal cual vino para que una
    // edición a mano no le borre a la propiedad el link con el que se la puede
    // volver a leer.
    origen: OrigenImport | null
    revision: EstadoRevision
    // Round-trip, igual que ownerUid: el formulario los reenvía tal cual
    // vinieron. Ver el comentario gemelo en rentals/[id].vue.
    motivoRechazo: string | null
    revisadaPor: string | null
    revisadaEn: unknown
  }
>({
  id: '',
  titulo: '',
  barrio: '',
  tipo: 'monoambiente',
  precio: 0,
  moneda: 'USD',
  disponibilidad: 'disponible',
  superficie: 0,
  superficieCubierta: undefined,
  ambientes: undefined,
  banios: undefined,
  antiguedad: '',
  expensas: undefined,
  aptoCredito: false,
  amueblado: false,
  amenities: [],
  descripcion: '',
  fotos: [],
  direccion: '',
  direccionUrl: '',
  lat: null,
  lng: null,
  whatsappMsg: '',
  fichaUrl: '',
  esPropio: false,
  sellerUid: null,
  sellerNombre: null,
  ownerUid: null,
  propietarioNombre: null,
  propietarioContacto: null,
  origen: null,
  // Default de admin; si el que entra es vendedor, el onMounted lo baja.
  revision: 'aprobada',
  motivoRechazo: null,
  revisadaPor: null,
  revisadaEn: null,
})

// La fecha en la que se leyó la ficha, para mostrarla en el formulario. Se
// arma a mano desde el ISO y no con toLocaleDateString(): el panel es SSR y el
// server no tiene por qué compartir zona horaria ni locale con el navegador.
const origenLeidoEn = computed(() => {
  const iso = form.origen?.leidoEn
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)
    ? iso.slice(0, 10).split('-').reverse().join('/')
    : ''
})

const isAdmin = computed(() => role.value === 'admin')
const listRoute = computed(() => (isAdmin.value ? '/app/admin/sales' : '/app/seller/listings'))
const sellers = ref<SellerOption[]>([])

// El vendedor la carga sólo al dar de alta (es quien tiene el dato del dueño
// de primera mano), pero no vuelve a verla al editar después: una vez
// cargada queda de uso interno del admin. `isNew` no es reactivo, pero no
// hace falta — no cambia en la vida del componente (viene del id de la ruta).
const puedeCargarPropietario = computed(() => isAdmin.value || (isNew && role.value === 'seller'))

onMounted(async () => {
  role.value = await fetchUserRole()

  if (isAdmin.value) {
    // See rentals/[id].vue's sibling comment — firestore.rules only allows
    // a `list` on `users` for an admin caller, so this fetch stays gated.
    const allUsers = await listAll<SellerOption & { role?: string | null }>('users')
    sellers.value = allUsers.filter((u) => u.role === 'seller')
  }

  if (isNew) {
    if (role.value === 'seller') {
      form.sellerUid = user.value?.uid ?? null
      // Desnormalizado a propósito: ver el comentario gemelo en
      // rentals/[id].vue y ListingMeta en types/property.ts.
      form.sellerNombre = user.value?.displayName || user.value?.email || null
      form.revision = 'pendiente'
    }
    return
  }
  const existing = await getOne<SaleRow>('sales', id)
  if (!existing) {
    notFound.value = true
    loading.value = false
    return
  }
  Object.assign(form, existing, {
    sellerUid: existing.sellerUid ?? null,
    sellerNombre: existing.sellerNombre ?? null,
    ownerUid: existing.ownerUid ?? null,
    propietarioNombre: existing.propietarioNombre ?? null,
    propietarioContacto: existing.propietarioContacto ?? null,
    origen: existing.origen ?? null,
    revision: revisionDe(existing),
    motivoRechazo: existing.motivoRechazo ?? null,
    revisadaPor: existing.revisadaPor ?? null,
    revisadaEn: existing.revisadaEn ?? null,
  })
  loading.value = false
})

async function checkId() {
  const candidato = form.id.trim()
  idError.value = ''
  if (!isNew || !candidato) return
  if (await idExists('sales', candidato)) {
    idError.value = `Ya hay una venta con el ID "${candidato}". Elegí otro.`
  }
}

// Alta desde el link para colegas, igual que en rentals/[id].vue: el de Tokko
// (ficha.info) o el de Tencery (fichaprop.tech). `importFromFicha` lee la ficha
// en el server y la mapea al catálogo de ventas: precio de venta, metros,
// ambientes, baños, expensas y antigüedad, más el próximo id libre de la serie
// que le toca (`ven-NN` las de Tokko, `tenc-NN` las de Tencery).
//
// Ojo con las de Tencery: su catálogo es de alquiler temporario y no tiene
// operación de venta, así que el precio viene en 0 y hay que cargarlo a mano.
// El aviso lo dice.
//
// La diferencia con alquileres es la galería: la ficha trae hasta 20 fotos y
// caen todas en la lista de links pendientes, así que al guardar terminan en
// nuestro Storage por el mismo camino que una foto pegada a mano.
const fichaUrlInput = ref('')
const importando = ref(false)
const importAvisos = ref<string[]>([])
const importError = ref('')

async function onImportarFicha() {
  importError.value = ''
  importAvisos.value = []
  importando.value = true
  try {
    const importFromFicha = callable<
      { url: string; collectionName: 'rentals' | 'sales' },
      {
        prop: Record<string, unknown> & { fotos?: string[] }
        avisos: string[]
        sugerencias: { id: string }
      }
    >('importFromFicha')
    const { data } = await importFromFicha({ url: fichaUrlInput.value.trim(), collectionName: 'sales' })

    const { fotos, ...campos } = data.prop
    Object.assign(form, campos)
    // `fotos` del formulario son las que ya están en nuestro Storage; las de la
    // ficha todavía son del CDN de Tokko, así que van a la lista de pendientes.
    newUrls.value = (fotos || []).slice(0, MAX_FOTOS - form.fotos.length - newFiles.value.length)
    form.id = data.sugerencias.id
    idError.value = ''
    importAvisos.value = data.avisos
  } catch (e) {
    importError.value = (e as Error).message
  } finally {
    importando.value = false
  }
}

// Ver el comentario gemelo en rentals/[id].vue: el nombre del vendedor viaja
// desnormalizado, así que reasignar la propiedad tiene que actualizarlo.
function onSellerChange() {
  const s = sellers.value.find((x) => x.id === form.sellerUid)
  form.sellerNombre = s ? s.displayName || s.email || null : null
}

const totalFotos = computed(() => form.fotos.length + newFiles.value.length + newUrls.value.length)

function onFilesChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  const room = MAX_FOTOS - totalFotos.value
  newFiles.value.push(...files.slice(0, Math.max(room, 0)))
}

function addUrl() {
  const url = urlDraft.value.trim()
  if (!url || totalFotos.value >= MAX_FOTOS) return
  newUrls.value.push(url)
  urlDraft.value = ''
}

function removeExistingPhoto(index: number) {
  form.fotos.splice(index, 1)
}

function removePendingFile(index: number) {
  newFiles.value.splice(index, 1)
}

function removePendingUrl(index: number) {
  newUrls.value.splice(index, 1)
}

async function onSubmit() {
  formError.value = ''
  // fotos[0] es la portada del catálogo: sin una foto no hay ficha que mostrar.
  if (!totalFotos.value) {
    formError.value = 'Falta la foto de portada: subí al menos una foto.'
    return
  }
  saving.value = true
  savingNote.value = 'Guardando…'
  saveError.value = ''
  try {
    const docId = isNew ? form.id.trim() : id
    if (!docId) {
      formError.value = 'El ID es obligatorio.'
      return
    }
    // Editar manda de vuelta a revisión. firestore.rules exige lo mismo, así
    // que sacarlo de acá no publica directo: hace fallar el guardado. Ver el
    // comentario gemelo en rentals/[id].vue.
    if (role.value === 'seller') form.revision = 'pendiente'

    // Última chance para el pin: si la propiedad quedó sin ubicar —nadie tocó
    // el botón, el link corto no se resolvió, la dirección se escribió al
    // final— lo resolvemos acá, del lado del servidor, antes de escribir. Si
    // tampoco sale, va como null: el catálogo la muestra igual, sin pin.
    if (form.lat == null || form.lng == null) {
      savingNote.value = 'Ubicando en el mapa…'
      const pin = await resolverPin(form.direccion, form.direccionUrl)
      if (pin?.ok) {
        form.lat = pin.lat
        form.lng = pin.lng
      }
      savingNote.value = 'Guardando…'
    }

    // lat/lng explícitos: si nunca se pudo ubicar la dirección van como null.
    // Firestore tira error si le llega un undefined.
    const { id: _drop, ...data } = { ...form, lat: form.lat ?? null, lng: form.lng ?? null }
    // Save first — firestore.rules needs the doc (with the right
    // sellerUid) to already exist before it'll allow uploads for it.
    //
    // En un alta, createOne() en vez de saveOne(): rechaza el id repetido en
    // vez de mezclarse con la propiedad que ya lo tenía (ver adminCrud.ts).
    // Como el guardado va primero, corta antes de subir una sola foto.
    if (isNew) await createOne('sales', docId, data)
    else await saveOne('sales', docId, data)

    // Archivos primero y links después, el mismo orden en que se ven abajo en
    // la grilla de pendientes. Las dos formas terminan igual: una URL de
    // nuestro Storage adentro de form.fotos.
    const pendientes = [
      ...newFiles.value.map((file) => ({ file, url: '' })),
      ...newUrls.value.map((url) => ({ file: null as File | null, url })),
    ]
    if (pendientes.length) {
      const startIndex = form.fotos.length
      const uploaded: string[] = []
      for (let i = 0; i < pendientes.length; i++) {
        const item = pendientes[i]
        const slot = startIndex + i + 1
        savingNote.value = `${item.file ? 'Subiendo' : 'Copiando'} foto ${i + 1} de ${pendientes.length}…`
        if (item.file) {
          const ext = item.file.name.split('.').pop() || 'jpg'
          uploaded.push(await uploadPropertyImage('sales', docId, `${slot}.${ext}`, item.file))
        } else {
          uploaded.push(await importPropertyImageFromUrl('sales', docId, String(slot), item.url))
        }
      }
      savingNote.value = 'Guardando…'
      form.fotos.push(...uploaded)
      await saveOne('sales', docId, { fotos: form.fotos })
      newFiles.value = []
      newUrls.value = []
    }

    // Vuelve a la lista marcando lo que se acaba de guardar: allá el cartel
    // con el link a la ficha y la propiedad primera de la lista (useJustSaved).
    await navigateTo({
      path: listRoute.value,
      query: { saved: docId, kind: 'sale', ...(isNew ? { new: '1' } : {}) },
    })
  } catch (e) {
    if (e instanceof DuplicateIdError) {
      idError.value = `Ya hay una venta con el ID "${e.duplicatedId}". Elegí otro.`
      alert(`${idError.value}\n\nNo se guardó nada: la propiedad que ya tenía ese ID quedó intacta.`)
    } else {
      // Sin esto, un rechazo de firestore.rules (o cualquier otro error) se
      // perdía en silencio: el botón volvía a "Guardar" y parecía que no había
      // pasado nada, sin ninguna pista de que el guardado falló.
      saveError.value = e instanceof Error ? e.message : 'No se pudo guardar. Volvé a intentar.'
    }
  } finally {
    saving.value = false
    savingNote.value = ''
  }
}

async function onDelete() {
  if (!confirm(`¿Eliminar "${form.titulo}"? Esta acción no se puede deshacer.`)) return
  await removeOne('sales', id)
  await navigateTo(listRoute.value)
}
</script>

<template>
  <main class="container py-4" style="max-width: 640px">
    <p v-if="loading">Cargando…</p>
    <p v-else-if="notFound">No se encontró esta propiedad.</p>

    <form v-else @submit.prevent="onSubmit">
      <h1 class="h4 mb-3">{{ isNew ? 'Nueva venta' : `Editar: ${form.titulo}` }}</h1>

      <!-- De dónde salió la propiedad. Se muestra y no se edita: es el link con
           el que se la va a poder volver a leer para refrescar los datos. -->
      <p v-if="!isNew && form.origen" class="small text-muted mb-3">
        Importada de
        <a :href="form.origen.url" target="_blank" rel="noopener">{{ form.origen.fuente }}</a>
        <span v-if="origenLeidoEn"> el {{ origenLeidoEn }}</span>
      </p>

      <RevisionNotice
        v-if="!isNew"
        :revision="form.revision"
        :motivo-rechazo="form.motivoRechazo"
        :is-admin="isAdmin"
      />

      <AdminSection v-if="isNew" title="Importar desde una ficha">
        <p class="small text-muted mb-2">
          Pegá el link para colegas —de Tokko (ficha.info) o de Tencery (fichaprop.tech)— y se completa solo,
          fotos incluidas. Después revisá y corregí lo que haga falta.
        </p>
        <div class="input-group">
          <input
            v-model="fichaUrlInput"
            type="url"
            class="form-control"
            placeholder="https://ficha.info/p/... o https://www.fichaprop.tech/ficha/..."
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :disabled="importando"
            @keydown.enter.prevent="onImportarFicha"
          />
          <button
            type="button"
            class="btn btn-outline-primary"
            :disabled="importando || !fichaUrlInput.trim()"
            @click="onImportarFicha"
          >
            {{ importando ? 'Trayendo…' : 'Traer datos' }}
          </button>
        </div>
        <p v-if="importError" class="text-danger small mt-2 mb-0">{{ importError }}</p>
        <div v-if="importAvisos.length" class="alert alert-info br-app-notice mt-2 mb-0">
          <strong class="small">Listo. Revisá esto antes de guardar:</strong>
          <ul class="small mb-0 mt-1 ps-3">
            <li v-for="a in importAvisos" :key="a">{{ a }}</li>
          </ul>
        </div>
      </AdminSection>

      <AdminSection title="Identificación">
        <div class="mb-2">
          <label class="form-label small is-required">ID {{ !isNew ? '(no editable)' : '(slug único)' }}</label>
          <!-- Ver rentals/[id].vue: iOS capitaliza y autocorrige el ID del doc. -->
          <input
            v-model="form.id"
            type="text"
            class="form-control"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :disabled="!isNew"
            required
            @input="idError = ''"
            @blur="checkId"
          />
          <p v-if="idError" class="text-danger small mt-1 mb-0">{{ idError }}</p>
        </div>

        <div class="mb-2">
          <label class="form-label small is-required">Título</label>
          <input v-model="form.titulo" type="text" class="form-control" required />
        </div>

        <div class="row g-2">
          <div class="col-12 col-sm-6">
            <label class="form-label small is-required">Barrio</label>
            <input v-model="form.barrio" type="text" class="form-control" required />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label small is-required">Tipo</label>
            <select v-model="form.tipo" class="form-select">
              <option v-for="tp in TIPOS" :key="tp" :value="tp">{{ tp }}</option>
            </select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Precio y disponibilidad">
        <div class="row g-2">
          <div class="col-6 col-sm-4">
            <!-- min=1: el 0 sigue siendo "Consultar precio" en el catálogo,
                 pero desde acá ya no se publica sin precio. -->
            <label class="form-label small is-required">Precio</label>
            <input v-model.number="form.precio" type="number" min="1" class="form-control" required />
          </div>
          <div class="col-6 col-sm-4">
            <label class="form-label small">Moneda</label>
            <select v-model="form.moneda" class="form-select">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-12 col-sm-4">
            <label class="form-label small">Disponibilidad</label>
            <select v-model="form.disponibilidad" class="form-select">
              <option value="disponible">disponible</option>
              <option value="reservado">reservado</option>
              <option value="vendido">vendido</option>
            </select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Características">
        <!-- Eran cuatro col-3 en una sola fila: ~80px por campo en una pantalla
             de 375px, con etiquetas como "Superficie cubierta". -->
        <div class="row g-2 mb-2">
          <div class="col-6 col-md-3">
            <label class="form-label small is-required">Superficie total (m²)</label>
            <input v-model.number="form.superficie" type="number" min="1" class="form-control" required />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small">Superficie cubierta</label>
            <input v-model.number="form.superficieCubierta" type="number" min="0" class="form-control" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small">Ambientes</label>
            <input v-model.number="form.ambientes" type="number" min="0" class="form-control" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small">Baños</label>
            <input v-model.number="form.banios" type="number" min="0" class="form-control" />
          </div>
        </div>

        <div class="row g-2 mb-3">
          <div class="col-12 col-sm-6">
            <label class="form-label small">Antigüedad</label>
            <input v-model="form.antiguedad" type="text" class="form-control" placeholder="A estrenar / años" />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label small">Expensas (ARS)</label>
            <input v-model.number="form.expensas" type="number" min="0" class="form-control" />
          </div>
        </div>

        <!-- Chips: ver el comentario equivalente en rentals/[id].vue. -->
        <div class="br-app-chips">
          <div>
            <input id="amueblado" v-model="form.amueblado" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="amueblado">Amueblado</label>
          </div>
          <div>
            <input id="apto-credito" v-model="form.aptoCredito" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="apto-credito">🏦 Apto crédito</label>
          </div>
          <div v-if="isAdmin">
            <input id="espropio" v-model="form.esPropio" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="espropio">★ BairesRental (propio)</label>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Amenities del edificio">
        <div class="br-app-chips">
          <div v-for="a in AMENITIES" :key="a">
            <input :id="`am-${a}`" v-model="form.amenities" type="checkbox" :value="a" class="br-app-chip-input" />
            <label class="br-app-chip-label" :for="`am-${a}`">{{ AMENITY_EMOJI[a] }} {{ a }}</label>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Descripción">
        <textarea v-model="form.descripcion" class="form-control" rows="4" required></textarea>
      </AdminSection>

      <AdminSection title="Fotos">
        <label class="form-label small d-block is-required">
          Fotos ({{ totalFotos }}/{{ MAX_FOTOS }}) — la primera es la portada
        </label>
        <!-- Grid fluido en vez de un flex de miniaturas de 80px fijos: en un
             celular entran 3 por fila y se estiran a lo que haya. -->
        <div v-if="totalFotos" class="br-app-photos mb-2">
          <div v-for="(foto, i) in form.fotos" :key="foto" class="br-app-photo">
            <img :src="foto" alt="" />
            <button
              type="button"
              class="btn br-app-photo-del"
              :aria-label="`Quitar foto ${i + 1}`"
              @click="removeExistingPhoto(i)"
            >
              ✕
            </button>
          </div>
          <div v-for="(file, i) in newFiles" :key="file.name + i" class="br-app-photo">
            <div class="br-app-photo-pending">{{ file.name.slice(0, 18) }}</div>
            <button
              type="button"
              class="btn br-app-photo-del"
              :aria-label="`Quitar ${file.name}`"
              @click="removePendingFile(i)"
            >
              ✕
            </button>
          </div>
          <!-- Los links todavía apuntan afuera: se ven igual, pero recién al
               guardar pasan a nuestro Storage. -->
          <div v-for="(url, i) in newUrls" :key="url + i" class="br-app-photo">
            <img :src="url" alt="" />
            <button type="button" class="btn br-app-photo-del" :aria-label="`Quitar ${url}`" @click="removePendingUrl(i)">
              ✕
            </button>
          </div>
        </div>
        <input type="file" accept="image/*" multiple class="form-control" @change="onFilesChange" />

        <label class="form-label small mt-2 mb-1">…o pegá el link de una foto</label>
        <div class="d-flex gap-2">
          <input
            v-model="urlDraft"
            type="url"
            inputmode="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
            placeholder="https://…"
            :disabled="totalFotos >= MAX_FOTOS"
            @keydown.enter.prevent="addUrl"
          />
          <button type="button" class="btn btn-outline-secondary" :disabled="totalFotos >= MAX_FOTOS" @click="addUrl">
            Agregar
          </button>
        </div>
        <p class="form-text small mb-0">Las copiamos a nuestro servidor al guardar.</p>
      </AdminSection>

      <PropertyLocationFields
        v-model:direccion="form.direccion"
        v-model:direccionUrl="form.direccionUrl"
        v-model:lat="form.lat"
        v-model:lng="form.lng"
      />

      <AdminSection title="WhatsApp y links externos">
        <div class="mb-2">
          <label class="form-label small">Mensaje de WhatsApp pre-completado</label>
          <input v-model="form.whatsappMsg" type="text" class="form-control" />
        </div>
        <div>
          <label class="form-label small">fichaUrl (Zonaprop/Argenprop, opcional)</label>
          <input
            v-model="form.fichaUrl"
            type="url"
            inputmode="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
          />
        </div>
      </AdminSection>

      <AdminSection v-if="isAdmin" title="Vendedor">
        <label class="form-label small">Vendedor asignado</label>
        <!-- @change: reasignar tiene que actualizar el `sellerNombre`
             desnormalizado. Ver el comentario gemelo en rentals/[id].vue. -->
        <select v-model="form.sellerUid" class="form-select" @change="onSellerChange">
          <option :value="null">— (gestiona BairesRental)</option>
          <option v-for="s in sellers" :key="s.id" :value="s.id">{{ s.email || s.id }} ({{ s.id.slice(0, 8) }}…)</option>
        </select>
      </AdminSection>

      <!-- Dato de contacto interno del equipo, sin cuenta ni login — no
           confundir con `ownerUid` (portal de dueños). El vendedor la carga
           al dar de alta y no la vuelve a ver después (puedeCargarPropietario). -->
      <AdminSection v-if="puedeCargarPropietario" title="Propietario">
        <label class="form-label small">Nombre del dueño</label>
        <input v-model="form.propietarioNombre" type="text" class="form-control mb-2" placeholder="Ej: María Gómez" />
        <label class="form-label small">Contacto del dueño</label>
        <input v-model="form.propietarioContacto" type="text" class="form-control" placeholder="Teléfono o email" />
      </AdminSection>

      <p v-if="formError" class="text-danger small mb-2">{{ formError }}</p>

      <div v-if="saveError" class="alert alert-warning br-app-notice" role="alert">
        <div class="small">{{ saveError }}</div>
      </div>

      <!-- Pegajosa abajo en mobile — ver rentals/[id].vue. Acá importa todavía
           más: este formulario es más largo y el guardado puede tardar minutos
           si hay fotos, así que el estado tiene que quedar a la vista. -->
      <div class="br-app-form-actions">
        <button type="submit" class="btn btn-primary" :disabled="saving || !!idError">
          {{ saving ? savingNote : '💾 Guardar' }}
        </button>
        <NuxtLink :to="listRoute" class="btn btn-outline-secondary">Cancelar</NuxtLink>
        <button
          v-if="!isNew"
          type="button"
          class="btn btn-outline-danger br-app-btn-del"
          title="Eliminar"
          aria-label="Eliminar"
          @click="onDelete"
        >
          🗑
        </button>
      </div>
    </form>
  </main>
</template>
