<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../stores/auth'
import { getOne, saveOne, removeOne } from '../../data/adminCrud'
import { uploadPropertyImage } from '../../data/storageUpload'
import { AMENITY_EMOJI } from '../../data/amenities'
import type { RentalProperty } from '../../data/properties'
import AppShellLayout from '../../layouts/AppShellLayout.vue'

useHead({ title: 'BairesRental — Editar alquiler', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const id = route.params.id as string
const isNew = id === 'new'
const loading = ref(!isNew)
const saving = ref(false)
const notFound = ref(false)
const imageFile = ref<File | null>(null)

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

const isAdmin = computed(() => authStore.role === 'admin')
const listRouteName = computed(() => (isAdmin.value ? 'admin-rentals' : 'seller-listings'))

onMounted(async () => {
  await authStore.init()
  if (isNew) {
    if (authStore.role === 'seller') form.sellerUid = authStore.user?.uid ?? null
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
  try {
    const docId = isNew ? form.id.trim() : id
    if (!docId) {
      alert('El ID es obligatorio.')
      return
    }
    const { id: _drop, ...data } = form
    // Save the doc first — storage.rules needs it to already exist (with
    // the right sellerUid) before it'll allow the image upload below.
    await saveOne('rentals', docId, data)

    if (imageFile.value) {
      const ext = imageFile.value.name.split('.').pop() || 'jpg'
      const url = await uploadPropertyImage('rentals', docId, `cover.${ext}`, imageFile.value)
      await saveOne('rentals', docId, { imagen: url })
    }

    router.push({ name: listRouteName.value })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!confirm(`¿Eliminar "${form.titulo}"? Esta acción no se puede deshacer.`)) return
  await removeOne('rentals', id)
  router.push({ name: listRouteName.value })
}
</script>

<template>
  <AppShellLayout>
    <main class="container py-4" style="max-width: 640px">
      <p v-if="loading">Cargando…</p>
      <p v-else-if="notFound">No se encontró esta propiedad.</p>

      <form v-else @submit.prevent="onSubmit">
        <h1 class="h4 mb-3">{{ isNew ? 'Nuevo alquiler' : `Editar: ${form.titulo}` }}</h1>

        <div class="mb-2">
          <label class="form-label small">ID {{ !isNew ? '(no editable)' : '(slug único, ej: marie-01)' }}</label>
          <input v-model="form.id" type="text" class="form-control" :disabled="!isNew" required />
        </div>

        <div class="mb-2">
          <label class="form-label small">Título</label>
          <input v-model="form.titulo" type="text" class="form-control" required />
        </div>

        <div class="row g-2 mb-2">
          <div class="col-6">
            <label class="form-label small">Barrio</label>
            <input v-model="form.barrio" type="text" class="form-control" required />
          </div>
          <div class="col-6">
            <label class="form-label small">Tipo</label>
            <select v-model="form.tipo" class="form-select">
              <option v-for="tp in TIPOS" :key="tp" :value="tp">{{ tp }}</option>
            </select>
          </div>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-4">
            <label class="form-label small">Precio (0 = consultar)</label>
            <input v-model.number="form.precio" type="number" min="0" class="form-control" />
          </div>
          <div class="col-4">
            <label class="form-label small">Moneda</label>
            <select v-model="form.moneda" class="form-select">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-4">
            <label class="form-label small">Disponibilidad</label>
            <select v-model="form.disponibilidad" class="form-select">
              <option value="disponible">disponible</option>
              <option value="reservado">reservado</option>
              <option value="no disponible">no disponible</option>
            </select>
          </div>
        </div>

        <div class="mb-2">
          <label class="form-label small">Disponible desde (opcional)</label>
          <input v-model="form.disponibleDesde" type="date" class="form-control" />
        </div>

        <div class="d-flex gap-3 mb-2 flex-wrap">
          <div class="form-check">
            <input id="amueblado" v-model="form.amueblado" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="amueblado">Amueblado</label>
          </div>
          <div class="form-check">
            <input id="mascotas" v-model="form.mascotas" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="mascotas">Acepta mascotas</label>
          </div>
          <div class="form-check">
            <input id="servicios" v-model="form.serviciosIncluidos" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="servicios">Servicios incluidos</label>
          </div>
          <div v-if="isAdmin" class="form-check">
            <input id="espropio" v-model="form.esPropio" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="espropio">★ BairesRental (propio)</label>
          </div>
        </div>

        <div class="mb-2" style="max-width: 160px">
          <label class="form-label small">Mínimo de meses</label>
          <input v-model.number="form.minimoMeses" type="number" min="1" class="form-control" />
        </div>

        <div class="mb-2">
          <label class="form-label small d-block">Amenities</label>
          <div class="d-flex flex-wrap gap-2">
            <div v-for="a in AMENITIES" :key="a" class="form-check">
              <input :id="`am-${a}`" v-model="form.amenities" type="checkbox" :value="a" class="form-check-input" />
              <label class="form-check-label" :for="`am-${a}`">{{ AMENITY_EMOJI[a] }} {{ a }}</label>
            </div>
          </div>
        </div>

        <div class="mb-2">
          <label class="form-label small">Descripción</label>
          <textarea v-model="form.descripcion" class="form-control" rows="4"></textarea>
        </div>

        <div class="mb-2">
          <label class="form-label small">Foto de portada</label>
          <img v-if="form.imagen" :src="form.imagen" alt="" class="d-block mb-2 rounded" style="max-height: 140px" />
          <input type="file" accept="image/*" class="form-control" @change="onFileChange" />
        </div>

        <div class="mb-2">
          <label class="form-label small">Álbum completo (ficha.info o Google Photos)</label>
          <input v-model="form.fotos" type="text" class="form-control" />
        </div>

        <div class="mb-2">
          <label class="form-label small">fichaUrl (link directo Airbnb/Booking, opcional)</label>
          <input v-model="form.fichaUrl" type="text" class="form-control" />
        </div>

        <div class="row g-2 mb-2">
          <div class="col-6">
            <label class="form-label small">Dirección</label>
            <input v-model="form.direccion" type="text" class="form-control" />
          </div>
          <div class="col-6">
            <label class="form-label small">Link de Google Maps</label>
            <input v-model="form.direccionUrl" type="text" class="form-control" />
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label small">Mensaje de WhatsApp pre-completado</label>
          <input v-model="form.whatsappMsg" type="text" class="form-control" />
        </div>

        <div v-if="isAdmin" class="mb-3">
          <label class="form-label small">sellerUid (vacío = gestionado por BairesRental)</label>
          <input v-model="form.sellerUid" type="text" class="form-control" placeholder="uid del vendedor, opcional" />
        </div>

        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : '💾 Guardar' }}</button>
          <button v-if="!isNew" type="button" class="btn btn-outline-danger" @click="onDelete">🗑 Eliminar</button>
          <router-link :to="{ name: listRouteName }" class="btn btn-outline-secondary">Cancelar</router-link>
        </div>
      </form>
    </main>
  </AppShellLayout>
</template>
