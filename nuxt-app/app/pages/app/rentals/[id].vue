<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AMENITY_EMOJI } from '~/utils/amenities'
import type { RentalProperty } from '~/types/property'

interface SellerOption {
  id: string
  email: string | null
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
const imageFile = ref<File | null>(null)
const role = ref<string | null>(null)

const TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa']
const AMENITIES = Object.keys(AMENITY_EMOJI)

const form = reactive<Omit<RentalProperty, 'id'> & { id: string; sellerUid: string | null; ownerUid: string | null }>({
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
  whatsappMsg: '',
  esPropio: false,
  sellerUid: null,
  ownerUid: null,
})

const isAdmin = computed(() => role.value === 'admin')
const listRoute = computed(() => (isAdmin.value ? '/app/admin/rentals' : '/app/seller/listings'))
const sellers = ref<SellerOption[]>([])

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
    if (role.value === 'seller') form.sellerUid = user.value?.uid ?? null
    return
  }
  const existing = await getOne<RentalProperty & { sellerUid?: string | null; ownerUid?: string | null }>('rentals', id)
  if (!existing) {
    notFound.value = true
    loading.value = false
    return
  }
  Object.assign(form, existing, { sellerUid: existing.sellerUid ?? null, ownerUid: existing.ownerUid ?? null })
  loading.value = false
})

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  imageFile.value = file || null
}

async function onSubmit() {
  saving.value = true
  savingNote.value = 'Guardando…'
  try {
    const docId = isNew ? form.id.trim() : id
    if (!docId) {
      alert('El ID es obligatorio.')
      return
    }
    const { id: _drop, ...data } = form
    // Save the doc first — firestore.rules needs it to already exist (with
    // the right sellerUid) before it'll allow the image upload below.
    await saveOne('rentals', docId, data)

    if (imageFile.value) {
      savingNote.value = 'Subiendo la foto…'
      const ext = imageFile.value.name.split('.').pop() || 'jpg'
      const url = await uploadPropertyImage('rentals', docId, `cover.${ext}`, imageFile.value)
      await saveOne('rentals', docId, { imagen: url })
    }

    await navigateTo(listRoute.value)
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

      <AdminSection title="Identificación">
        <div class="mb-2">
          <label class="form-label small">ID {{ !isNew ? '(no editable)' : '(slug único, ej: marie-01)' }}</label>
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
        <div class="row g-2 mb-2">
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
        <textarea v-model="form.descripcion" class="form-control" rows="4"></textarea>
      </AdminSection>

      <AdminSection title="Fotos">
        <div class="mb-2">
          <label class="form-label small">Foto de portada</label>
          <img v-if="form.imagen" :src="form.imagen" alt="" class="d-block mb-2 rounded" style="max-height: 140px" />
          <input type="file" accept="image/*" class="form-control" @change="onFileChange" />
        </div>

        <div class="mb-2">
          <label class="form-label small">Álbum completo (ficha.info o Google Photos)</label>
          <input
            v-model="form.fotos"
            type="url"
            inputmode="url"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
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

      <AdminSection title="WhatsApp">
        <label class="form-label small">Mensaje pre-completado</label>
        <input v-model="form.whatsappMsg" type="text" class="form-control" />
      </AdminSection>

      <AdminSection v-if="isAdmin" title="Vendedor">
        <label class="form-label small">Vendedor asignado</label>
        <select v-model="form.sellerUid" class="form-select">
          <option :value="null">— (gestiona BairesRental)</option>
          <option v-for="s in sellers" :key="s.id" :value="s.id">{{ s.email || s.id }} ({{ s.id.slice(0, 8) }}…)</option>
        </select>
      </AdminSection>

      <!-- Pegajosa abajo en mobile (br-app.css §7): el formulario es largo y si
           no hay que scrollear hasta el fondo para guardar. -->
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
