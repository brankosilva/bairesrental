<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AMENITY_EMOJI } from '~/utils/amenities'
import type { SaleProperty } from '~/types/property'

interface SellerOption {
  id: string
  email: string | null
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
const newFiles = ref<File[]>([])
const role = ref<string | null>(null)

const MAX_FOTOS = 20
const TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH']
const AMENITIES = Object.keys(AMENITY_EMOJI)

const form = reactive<Omit<SaleProperty, 'id'> & { id: string; sellerUid: string | null; ownerUid: string | null }>({
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
  whatsappMsg: '',
  fichaUrl: '',
  esPropio: false,
  sellerUid: null,
  ownerUid: null,
})

const isAdmin = computed(() => role.value === 'admin')
const listRoute = computed(() => (isAdmin.value ? '/app/admin/sales' : '/app/seller/listings'))
const sellers = ref<SellerOption[]>([])

onMounted(async () => {
  role.value = await fetchUserRole()

  if (isAdmin.value) {
    // See rentals/[id].vue's sibling comment — firestore.rules only allows
    // a `list` on `users` for an admin caller, so this fetch stays gated.
    const allUsers = await listAll<SellerOption & { role?: string | null }>('users')
    sellers.value = allUsers.filter((u) => u.role === 'seller')
  }

  if (isNew) {
    if (role.value === 'seller') form.sellerUid = user.value?.uid ?? null
    return
  }
  const existing = await getOne<SaleProperty & { sellerUid?: string | null; ownerUid?: string | null }>('sales', id)
  if (!existing) {
    notFound.value = true
    loading.value = false
    return
  }
  Object.assign(form, existing, { sellerUid: existing.sellerUid ?? null, ownerUid: existing.ownerUid ?? null })
  loading.value = false
})

function onFilesChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  const room = MAX_FOTOS - form.fotos.length - newFiles.value.length
  newFiles.value.push(...files.slice(0, Math.max(room, 0)))
}

function removeExistingPhoto(index: number) {
  form.fotos.splice(index, 1)
}

function removePendingFile(index: number) {
  newFiles.value.splice(index, 1)
}

async function onSubmit() {
  if (!form.superficie) {
    alert('La superficie es obligatoria.')
    return
  }
  saving.value = true
  savingNote.value = 'Guardando…'
  try {
    const docId = isNew ? form.id.trim() : id
    if (!docId) {
      alert('El ID es obligatorio.')
      return
    }
    const { id: _drop, ...data } = form
    // Save first — firestore.rules needs the doc (with the right
    // sellerUid) to already exist before it'll allow uploads for it.
    await saveOne('sales', docId, data)

    if (newFiles.value.length) {
      const startIndex = form.fotos.length
      const uploaded: string[] = []
      const total = newFiles.value.length
      for (let i = 0; i < total; i++) {
        savingNote.value = `Subiendo foto ${i + 1} de ${total}…`
        const file = newFiles.value[i]
        const ext = file.name.split('.').pop() || 'jpg'
        uploaded.push(await uploadPropertyImage('sales', docId, `${startIndex + i + 1}.${ext}`, file))
      }
      savingNote.value = 'Guardando…'
      form.fotos.push(...uploaded)
      await saveOne('sales', docId, { fotos: form.fotos })
      newFiles.value = []
    }

    await navigateTo(listRoute.value)
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

      <AdminSection title="Identificación">
        <div class="mb-2">
          <label class="form-label small">ID {{ !isNew ? '(no editable)' : '(slug único)' }}</label>
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
          />
        </div>

        <div class="mb-2">
          <label class="form-label small">Título</label>
          <input v-model="form.titulo" type="text" class="form-control" required />
        </div>

        <div class="row g-2">
          <div class="col-12 col-sm-6">
            <label class="form-label small">Barrio</label>
            <input v-model="form.barrio" type="text" class="form-control" required />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label small">Tipo</label>
            <select v-model="form.tipo" class="form-select">
              <option v-for="tp in TIPOS" :key="tp" :value="tp">{{ tp }}</option>
            </select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Precio y disponibilidad">
        <div class="row g-2">
          <div class="col-6 col-sm-4">
            <label class="form-label small">Precio (0 = consultar)</label>
            <input v-model.number="form.precio" type="number" min="0" class="form-control" />
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
            <label class="form-label small">Superficie total (m²)</label>
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
        <textarea v-model="form.descripcion" class="form-control" rows="4"></textarea>
      </AdminSection>

      <AdminSection title="Fotos">
        <label class="form-label small d-block">Fotos ({{ form.fotos.length + newFiles.length }}/{{ MAX_FOTOS }})</label>
        <!-- Grid fluido en vez de un flex de miniaturas de 80px fijos: en un
             celular entran 3 por fila y se estiran a lo que haya. -->
        <div v-if="form.fotos.length || newFiles.length" class="br-app-photos mb-2">
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
        </div>
        <input type="file" accept="image/*" multiple class="form-control" @change="onFilesChange" />
      </AdminSection>

      <AdminSection title="Ubicación">
        <div class="row g-2">
          <div class="col-12 col-sm-6">
            <label class="form-label small">Dirección</label>
            <input v-model="form.direccion" type="text" class="form-control" />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label small">Link de Google Maps</label>
            <input
              v-model="form.direccionUrl"
              type="url"
              inputmode="url"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              class="form-control"
            />
          </div>
        </div>
      </AdminSection>

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
        <select v-model="form.sellerUid" class="form-select">
          <option :value="null">— (gestiona BairesRental)</option>
          <option v-for="s in sellers" :key="s.id" :value="s.id">{{ s.email || s.id }} ({{ s.id.slice(0, 8) }}…)</option>
        </select>
      </AdminSection>

      <!-- Pegajosa abajo en mobile — ver rentals/[id].vue. Acá importa todavía
           más: este formulario es más largo y el guardado puede tardar minutos
           si hay fotos, así que el estado tiene que quedar a la vista. -->
      <div class="br-app-form-actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">
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
