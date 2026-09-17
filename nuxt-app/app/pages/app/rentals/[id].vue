<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AMENITY_EMOJI } from '~/utils/amenities'
import { DuplicateIdError } from '~/utils/adminCrud'
import type { RentalProperty, RentalRow, OrigenImport } from '~/types/property'
import { revisionDe, type EstadoRevision } from '~/utils/revision'
import { resolverPin } from '~/utils/pin'

interface SellerOption {
  id: string
  email: string | null
  displayName?: string | null
}

// Ported from app/src/pages/app/RentalForm.vue. `id === 'new'` still means
// creation, matching the old convention. Image upload goes through
// uploadPropertyImage() (app/utils/storageUpload.ts), which calls the
// existing, unchanged `uploadListingImage` callable.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['admin', 'seller'] })
useHead({ title: 'BairesRental — Editar alquiler', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const user = useCurrentUser()

const id = route.params.id as string
const isNew = id === 'new'
const loading = ref(!isNew)
const saving = ref(false)
// Qué está pasando mientras `saving` está en true. Antes el botón decía
// "Guardando…" durante todo el proceso, subida de imagen incluida: con datos
// móviles eso es un botón que parece colgado. Ver sales/[id].vue, donde son
// hasta 20 fotos y el problema es mucho peor.
const savingNote = ref('')
const notFound = ref(false)
// El id del documento lo tipea una persona y no se puede cambiar después: si ya
// está tomado avisamos acá, antes de que llene el formulario entero.
const idError = ref('')
// Lo que el `required` del navegador no puede chequear solo: la portada, que
// puede venir de tres lados distintos (la que ya está guardada, un archivo
// nuevo o un link pegado).
const formError = ref('')
const imageFile = ref<File | null>(null)
// La portada puede venir de un archivo o de un link (Tokko, Airbnb, lo que
// sea). Si viene de un link igual termina en nuestro Storage: la function
// `importListingImage` la baja y la guarda, así no dependemos de un CDN
// ajeno que puede dar de baja la publicación.
const imageUrl = ref('')
const role = ref<string | null>(null)
const saveError = ref('')

const TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa']
const AMENITIES = Object.keys(AMENITY_EMOJI)

// lat/lng salen del Omit para poder arrancar en null y no en undefined:
// Firestore rechaza el undefined y el formulario los escribe siempre, aunque
// no se haya podido ubicar la dirección (ver PropertyLocationFields.vue).
const form = reactive<
  Omit<RentalProperty, 'id' | 'lat' | 'lng'> & {
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
    // Se hacen round-trip como ownerUid: el formulario los reenvía tal cual
    // vinieron. Es lo que hace que firestore.rules deje pasar el guardado de
    // un vendedor sobre una propiedad rechazada — la regla mira affectedKeys(),
    // o sea lo que CAMBIÓ, y reenviar el mismo valor no cuenta como cambio.
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
  disponibleDesde: '',
  amueblado: false,
  mascotas: false,
  serviciosIncluidos: false,
  minimoMeses: 1,
  amenities: [],
  descripcion: '',
  imagen: '',
  fotos: '',
  fichaUrl: '',
  direccion: '',
  direccionUrl: '',
  lat: null,
  lng: null,
  whatsappMsg: '',
  esPropio: false,
  sellerUid: null,
  sellerNombre: null,
  ownerUid: null,
  propietarioNombre: null,
  propietarioContacto: null,
  origen: null,
  // Arranca en 'aprobada' porque el default de esta pantalla es el admin; si
  // el que entra es un vendedor, el onMounted de abajo lo baja a 'pendiente'.
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
const listRoute = computed(() => (isAdmin.value ? '/app/admin/rentals' : '/app/seller/listings'))
const sellers = ref<SellerOption[]>([])

// El vendedor la carga sólo al dar de alta (es quien tiene el dato del dueño
// de primera mano), pero no vuelve a verla al editar después: una vez
// cargada queda de uso interno del admin. `isNew` no es reactivo, pero no
// hace falta — no cambia en la vida del componente (viene del id de la ruta).
const puedeCargarPropietario = computed(() => isAdmin.value || (isNew && role.value === 'seller'))

onMounted(async () => {
  // Resolved inline (not via a separate onMounted-based composable) so the
  // isNew branch below can rely on it being settled before deciding
  // whether to prefill sellerUid.
  role.value = await fetchUserRole()

  if (isAdmin.value) {
    // firestore.rules only allows a `list` on `users` for an admin caller
    // (see rules' users/{uid} match) — gating this fetch behind isAdmin
    // keeps a seller's onMounted from firing a doomed, permission-denied
    // query for a field they can't even see (v-if="isAdmin" below).
    const allUsers = await listAll<SellerOption & { role?: string | null }>('users')
    sellers.value = allUsers.filter((u) => u.role === 'seller')
  }

  if (isNew) {
    if (role.value === 'seller') {
      form.sellerUid = user.value?.uid ?? null
      // El nombre va desnormalizado en el documento: las reglas no le dan a un
      // vendedor lectura sobre el users/{uid} de otro, así que el panel no
      // tendría de dónde sacar de quién es cada publicación del catálogo.
      form.sellerNombre = user.value?.displayName || user.value?.email || null
      // Lo que carga un vendedor no sale al sitio hasta que un admin lo
      // aprueba. Lo de un admin queda publicado al instante.
      form.revision = 'pendiente'
    }
    return
  }
  const existing = await getOne<RentalRow>('rentals', id)
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

// Al salir del campo, no mientras se tipea: un getDoc por tecla no aporta nada
// y el alta la valida createOne() igual, contra la base y en una transacción.
async function checkId() {
  const candidato = form.id.trim()
  idError.value = ''
  if (!isNew || !candidato) return
  if (await idExists('rentals', candidato)) {
    idError.value = `Ya hay un alquiler con el ID "${candidato}". Elegí otro.`
  }
}

// Alta desde el link para colegas: el de Tokko (ficha.info) o el de Tencery
// (fichaprop.tech). `importFromFicha` lee la ficha en el server —ninguna de las
// dos manda CORS, y la de Tencery además necesita pegarle a su API— y devuelve
// los campos ya mapeados más el próximo id libre de la serie que le toca
// (`alq-NN` las de Tokko, `tenc-NN` las de Tencery). Solo completa el
// formulario: guardar sigue siendo el mismo botón de siempre, así que lo
// importado se puede revisar y corregir antes de publicarlo.
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
      { prop: Record<string, unknown>; avisos: string[]; sugerencias: { id: string } }
    >('importFromFicha')
    const { data } = await importFromFicha({ url: fichaUrlInput.value.trim(), collectionName: 'rentals' })

    // La portada viene como URL del CDN de Tokko. Va al campo de "link de la
    // foto" y no a form.imagen, así al guardar `importListingImage` la copia a
    // nuestro Storage y el catálogo no queda colgado de un CDN ajeno.
    const { imagen, ...campos } = data.prop
    Object.assign(form, campos)
    if (typeof imagen === 'string' && imagen) {
      imageUrl.value = imagen
      imageFile.value = null
    }
    form.id = data.sugerencias.id
    idError.value = ''
    importAvisos.value = data.avisos
  } catch (e) {
    importError.value = (e as Error).message
  } finally {
    importando.value = false
  }
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  imageFile.value = file || null
  if (imageFile.value) imageUrl.value = ''
}

// El nombre del vendedor viaja desnormalizado en el documento (ver ListingMeta
// en types/property.ts), así que reasignar la propiedad tiene que actualizarlo
// acá: es lo único que ve el panel de un vendedor mirando la publicación de un
// colega, porque las reglas no le dejan leer el users/{uid} del otro.
function onSellerChange() {
  const s = sellers.value.find((x) => x.id === form.sellerUid)
  form.sellerNombre = s ? s.displayName || s.email || null : null
}

async function onSubmit() {
  formError.value = ''
  if (!form.imagen && !imageFile.value && !imageUrl.value.trim()) {
    formError.value = 'Falta la foto de portada: subí un archivo o pegá el link de una foto.'
    return
  }

  if (form.direccion.trim()) {
    const dup = await findDuplicateAddress<RentalRow>('rentals', form.direccion, isNew ? undefined : id)
    if (dup) {
      const seguir = confirm(
        `Ya hay un alquiler cargado con esta misma dirección: "${dup.titulo}" (id: ${dup.id}).\n\n¿Es una propiedad distinta y querés continuar de todos modos?`,
      )
      if (!seguir) return
    }
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
    // Editar manda de vuelta a revisión: si no, se aprueba una ficha limpia y
    // después se le cambia el texto, y la aprobación no querría decir nada.
    // firestore.rules exige esto mismo, así que sacarlo de acá no "publica
    // directo": hace fallar el guardado.
    //
    // El admin queda aprobado al instante, y `motivoRechazo`/`revisadaPor`/
    // `revisadaEn` se reenvían tal cual vinieron (la regla mira affectedKeys,
    // o sea lo que cambió: reenviar el mismo valor no cuenta como tocarlos).
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
    // Save the doc first — firestore.rules needs it to already exist (with
    // the right sellerUid) before it'll allow the image upload below.
    //
    // En un alta, createOne() en vez de saveOne(): rechaza el id repetido en
    // vez de mezclarse con la propiedad que ya lo tenía (ver adminCrud.ts).
    if (isNew) await createOne('rentals', docId, data)
    else await saveOne('rentals', docId, data)

    if (imageFile.value) {
      savingNote.value = 'Subiendo la foto…'
      const ext = imageFile.value.name.split('.').pop() || 'jpg'
      const url = await uploadPropertyImage('rentals', docId, `cover.${ext}`, imageFile.value)
      await saveOne('rentals', docId, { imagen: url })
    } else if (imageUrl.value.trim()) {
      savingNote.value = 'Copiando la foto…'
      const url = await importPropertyImageFromUrl('rentals', docId, 'cover', imageUrl.value.trim())
      await saveOne('rentals', docId, { imagen: url })
      form.imagen = url
      imageUrl.value = ''
    }

    // Vuelve a la lista marcando lo que se acaba de guardar: allá el cartel
    // con el link a la ficha y la propiedad primera de la lista (useJustSaved).
    await navigateTo({
      path: listRoute.value,
      query: { saved: docId, kind: 'rental', ...(isNew ? { new: '1' } : {}) },
    })
  } catch (e) {
    if (e instanceof DuplicateIdError) {
      idError.value = `Ya hay un alquiler con el ID "${e.duplicatedId}". Elegí otro.`
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
  await removeOne('rentals', id)
  await navigateTo(listRoute.value)
}
</script>

<template>
  <main class="container py-4" style="max-width: 640px">
    <p v-if="loading">Cargando…</p>
    <p v-else-if="notFound">No se encontró esta propiedad.</p>

    <form v-else @submit.prevent="onSubmit">
      <h1 class="h4 mb-3">{{ isNew ? 'Nuevo alquiler' : `Editar: ${form.titulo}` }}</h1>

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
          Pegá el link para colegas —de Tokko (ficha.info) o de Tencery (fichaprop.tech)— y se completa
          solo. Después revisá y corregí lo que haga falta.
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
          <label class="form-label small is-required">
            ID {{ !isNew ? '(no editable)' : '(slug único, ej: marie-01)' }}
          </label>
          <!-- autocapitalize/autocorrect: iOS capitaliza y "corrige" lo que se
               tipea acá, y esto es el ID del documento en Firestore. -->
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
        <div class="row g-2 mb-2">
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
              <option value="no disponible">no disponible</option>
            </select>
          </div>
        </div>

        <div>
          <label class="form-label small">Disponible desde (opcional)</label>
          <input v-model="form.disponibleDesde" type="date" class="form-control" />
        </div>
      </AdminSection>

      <AdminSection title="Características">
        <!-- Chips en vez de .form-check: el checkbox nativo es un target de
             ~16px, imposible de acertar con el pulgar. El input queda oculto y
             el label (44px de alto) es lo que se toca — ver br-app.css §7. -->
        <div class="br-app-chips mb-3">
          <div>
            <input id="amueblado" v-model="form.amueblado" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="amueblado">Amueblado</label>
          </div>
          <div>
            <input id="mascotas" v-model="form.mascotas" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="mascotas">Acepta mascotas</label>
          </div>
          <div>
            <input id="servicios" v-model="form.serviciosIncluidos" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="servicios">Servicios incluidos</label>
          </div>
          <div v-if="isAdmin">
            <input id="espropio" v-model="form.esPropio" type="checkbox" class="br-app-chip-input" />
            <label class="br-app-chip-label" for="espropio">★ BairesRental (propio)</label>
          </div>
        </div>

        <div style="max-width: 160px">
          <label class="form-label small">Mínimo de meses</label>
          <input v-model.number="form.minimoMeses" type="number" min="1" class="form-control" />
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
        <div class="mb-3">
          <label class="form-label small is-required">Foto de portada</label>
          <img v-if="form.imagen" :src="form.imagen" alt="" class="d-block mb-2 rounded" style="max-height: 140px" />
          <input type="file" accept="image/*" class="form-control" :disabled="!!imageUrl.trim()" @change="onFileChange" />

          <label class="form-label small mt-2 mb-1">…o pegá el link de una foto</label>
          <input
            v-model="imageUrl"
            type="url"
            inputmode="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
            placeholder="https://…"
            :disabled="!!imageFile"
          />
          <p class="form-text small mb-0">La copiamos a nuestro servidor al guardar.</p>
        </div>

        <div class="mb-2">
          <label class="form-label small is-required">Álbum completo (ficha.info o Google Photos)</label>
          <input
            v-model="form.fotos"
            type="url"
            inputmode="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
            required
          />
        </div>

        <div>
          <label class="form-label small">fichaUrl (link directo Airbnb/Booking, opcional)</label>
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

      <PropertyLocationFields
        v-model:direccion="form.direccion"
        v-model:direccionUrl="form.direccionUrl"
        v-model:lat="form.lat"
        v-model:lng="form.lng"
      />

      <AdminSection title="WhatsApp">
        <label class="form-label small">Mensaje pre-completado</label>
        <input v-model="form.whatsappMsg" type="text" class="form-control" />
      </AdminSection>

      <AdminSection v-if="isAdmin" title="Vendedor">
        <label class="form-label small">Vendedor asignado</label>
        <!-- @change y no sólo v-model: al reasignar hay que actualizar también
             el `sellerNombre` desnormalizado, o la publicación queda mostrando
             el nombre del vendedor anterior en el panel. -->
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

      <!-- Pegajosa abajo en mobile (br-app.css §7): el formulario es largo y si
           no hay que scrollear hasta el fondo para guardar. -->
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
