<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useAuthStore } from '../../stores/auth'
import { getOne, saveOne, removeOne } from '../../data/adminCrud'
import { uploadPropertyImage } from '../../data/storageUpload'
import { AMENITY_EMOJI } from '../../data/amenities'
import type { SaleProperty } from '../../data/properties'
import AppShellLayout from '../../layouts/AppShellLayout.vue'

useHead({ title: 'BairesRental — Editar venta', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const id = route.params.id as string
const isNew = id === 'new'
const loading = ref(!isNew)
const saving = ref(false)
const notFound = ref(false)
const newFiles = ref<File[]>([])

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

const isAdmin = computed(() => authStore.role === 'admin')
const listRouteName = computed(() => (isAdmin.value ? 'admin-sales' : 'seller-listings'))

onMounted(async () => {
  await authStore.init()
  if (isNew) {
    if (authStore.role === 'seller') form.sellerUid = authStore.user?.uid ?? null
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
  try {
    const docId = isNew ? form.id.trim() : id
    if (!docId) {
      alert('El ID es obligatorio.')
      return
    }
    const { id: _drop, ...data } = form
    // Save first — storage.rules needs the doc (with the right sellerUid)
    // to already exist before it'll allow uploads into this listing's path.
    await saveOne('sales', docId, data)

    if (newFiles.value.length) {
      const startIndex = form.fotos.length
      const uploaded: string[] = []
      for (let i = 0; i < newFiles.value.length; i++) {
        const file = newFiles.value[i]
        const ext = file.name.split('.').pop() || 'jpg'
        uploaded.push(await uploadPropertyImage('sales', docId, `${startIndex + i + 1}.${ext}`, file))
      }
      form.fotos.push(...uploaded)
      await saveOne('sales', docId, { fotos: form.fotos })
      newFiles.value = []
    }

    router.push({ name: listRouteName.value })
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!confirm(`¿Eliminar "${form.titulo}"? Esta acción no se puede deshacer.`)) return
  await removeOne('sales', id)
  router.push({ name: listRouteName.value })
}
</script>

<template>
  <AppShellLayout>
    <main class="container py-4" style="max-width: 640px">
      <p v-if="loading">Cargando…</p>
      <p v-else-if="notFound">No se encontró esta propiedad.</p>

      <form v-else @submit.prevent="onSubmit">
        <h1 class="h4 mb-3">{{ isNew ? 'Nueva venta' : `Editar: ${form.titulo}` }}</h1>

        <div class="mb-2">
          <label class="form-label small">ID {{ !isNew ? '(no editable)' : '(slug único)' }}</label>
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
              <option value="vendido">vendido</option>
            </select>
          </div>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-3">
            <label class="form-label small">Superficie total (m²)</label>
            <input v-model.number="form.superficie" type="number" min="1" class="form-control" required />
          </div>
          <div class="col-3">
            <label class="form-label small">Superficie cubierta</label>
            <input v-model.number="form.superficieCubierta" type="number" min="0" class="form-control" />
          </div>
          <div class="col-3">
            <label class="form-label small">Ambientes</label>
            <input v-model.number="form.ambientes" type="number" min="0" class="form-control" />
          </div>
          <div class="col-3">
            <label class="form-label small">Baños</label>
            <input v-model.number="form.banios" type="number" min="0" class="form-control" />
          </div>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-6">
            <label class="form-label small">Antigüedad</label>
            <input v-model="form.antiguedad" type="text" class="form-control" placeholder="A estrenar / años" />
          </div>
          <div class="col-6">
            <label class="form-label small">Expensas (ARS)</label>
            <input v-model.number="form.expensas" type="number" min="0" class="form-control" />
          </div>
        </div>

        <div class="d-flex gap-3 mb-2 flex-wrap">
          <div class="form-check">
            <input id="amueblado" v-model="form.amueblado" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="amueblado">Amueblado</label>
          </div>
          <div class="form-check">
            <input id="apto-credito" v-model="form.aptoCredito" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="apto-credito">🏦 Apto crédito</label>
          </div>
          <div v-if="isAdmin" class="form-check">
            <input id="espropio" v-model="form.esPropio" type="checkbox" class="form-check-input" />
            <label class="form-check-label" for="espropio">★ BairesRental (propio)</label>
          </div>
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
          <label class="form-label small d-block">Fotos ({{ form.fotos.length + newFiles.length }}/{{ MAX_FOTOS }})</label>
          <div class="d-flex flex-wrap gap-2 mb-2">
            <div v-for="(foto, i) in form.fotos" :key="foto" class="position-relative">
              <img :src="foto" alt="" class="rounded" style="width: 80px; height: 80px; object-fit: cover" />
              <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" style="padding: 0 6px" @click="removeExistingPhoto(i)">✕</button>
            </div>
            <div v-for="(file, i) in newFiles" :key="file.name + i" class="position-relative">
              <div class="rounded d-flex align-items-center justify-content-center bg-light text-muted small" style="width: 80px; height: 80px">
                {{ file.name.slice(0, 10) }}
              </div>
              <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" style="padding: 0 6px" @click="removePendingFile(i)">✕</button>
            </div>
          </div>
          <input type="file" accept="image/*" multiple class="form-control" @change="onFilesChange" />
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

        <div class="mb-2">
          <label class="form-label small">Mensaje de WhatsApp pre-completado</label>
          <input v-model="form.whatsappMsg" type="text" class="form-control" />
        </div>

        <div class="mb-3">
          <label class="form-label small">fichaUrl (Zonaprop/Argenprop, opcional)</label>
          <input v-model="form.fichaUrl" type="text" class="form-control" />
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
