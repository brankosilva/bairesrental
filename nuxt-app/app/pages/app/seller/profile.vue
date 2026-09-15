<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getStorage } from 'firebase/storage'
import type { SellerProfile } from '~/types/link'

// "Mi ficha": lo que ve el cliente cuando el vendedor le comparte un link.
//
// Vive en sellerProfiles/{uid}, NO en users/{uid}. users es privado y lo
// administra el admin (users.phone es un contacto interno); esto es una
// página pública con foto y número publicado. Si fueran el mismo documento,
// un admin editando el teléfono interno de alguien le cambiaría sin querer
// lo que aparece en una página que están viendo clientes.
//
// La foto sube DIRECTO a Storage con el SDK cliente, a diferencia de las
// fotos de las publicaciones, que tienen que pasar por la Cloud Function
// uploadListingImage. La diferencia es real y está explicada en
// storage.rules: acá la pertenencia está en la RUTA
// (sellerProfiles/{uid}/...), así que la regla la resuelve con
// request.auth.uid == uid, sin el firestore.get() cross-service que en este
// proyecto está confirmado roto.
definePageMeta({ layout: 'app-shell', middleware: 'auth', requiresAuth: true, allowedRoles: ['seller'] })
useHead({ title: 'BairesRental — Mi ficha', meta: [{ name: 'robots', content: 'noindex' }] })

const user = useCurrentUser()
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const feedback = ref<{ text: string; tone: 'success' | 'warning' } | null>(null)

const form = ref<Omit<SellerProfile, 'uid' | 'updatedAt'>>({
  displayName: '',
  title: null,
  photoUrl: null,
  whatsapp: null,
  bio: null,
  instagram: null,
  logoUrl: null,
  accentColor: null,
  slug: null,
  active: true,
})

// Preview en vivo del wa.me que se va a generar. La normalización es
// deliberadamente conservadora (ver normalizeWhatsapp en utils/format.ts):
// un número "corregido" de más es un cliente que nunca llega, así que en vez
// de adivinar, se le muestra al vendedor exactamente a dónde va a ir y se le
// deja un botón para probarlo él mismo.
const normalizedWa = computed(() => normalizeWhatsapp(form.value.whatsapp))
const waPreviewUrl = computed(() => (normalizedWa.value ? `https://wa.me/${normalizedWa.value}` : ''))

onMounted(async () => {
  const uid = user.value?.uid
  if (uid) {
    const snap = await getDoc(doc(useFirestore(), 'sellerProfiles', uid))
    if (snap.exists()) {
      const data = snap.data() as SellerProfile
      form.value = {
        displayName: data.displayName ?? '',
        title: data.title ?? null,
        photoUrl: data.photoUrl ?? null,
        whatsapp: data.whatsapp ?? null,
        bio: data.bio ?? null,
        instagram: data.instagram ?? null,
        logoUrl: data.logoUrl ?? null,
        accentColor: data.accentColor ?? null,
        slug: data.slug ?? null,
        active: data.active ?? true,
      }
    } else {
      // inviteUser/updateUser siembran la ficha al asignar el rol, así que
      // esto es el caso de un vendedor de antes de esa función.
      form.value.displayName = user.value?.displayName || ''
    }
  }
  loading.value = false
})

async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  const uid = user.value?.uid
  if (!file || !uid) return
  if (file.size > 2 * 1024 * 1024) {
    feedback.value = { text: 'La foto no puede pesar más de 2 MB.', tone: 'warning' }
    return
  }
  uploading.value = true
  feedback.value = null
  try {
    // Nombre fijo: reemplaza la anterior en vez de ir dejando huérfanas.
    const path = `sellerProfiles/${uid}/avatar.jpg`
    const r = storageRef(getStorage(useFirebaseApp()), path)
    await uploadBytes(r, file, { contentType: file.type, cacheControl: 'public, max-age=3600' })
    form.value.photoUrl = await getDownloadURL(r)
    await save({ silent: true })
    feedback.value = { text: 'Foto actualizada.', tone: 'success' }
  } catch (err) {
    feedback.value = { text: `No se pudo subir la foto: ${(err as Error).message}`, tone: 'warning' }
  } finally {
    uploading.value = false
  }
}

async function save({ silent = false }: { silent?: boolean } = {}) {
  const uid = user.value?.uid
  if (!uid) return
  if (!form.value.displayName.trim()) {
    feedback.value = { text: 'Poné tu nombre: es lo primero que ve el cliente.', tone: 'warning' }
    return
  }
  saving.value = true
  try {
    // `active` y `slug` NO se mandan: firestore.rules los rechaza si los
    // escribe un vendedor (son del admin). Mandarlos haría fallar el save
    // entero aunque no hubieran cambiado.
    await setDoc(
      doc(useFirestore(), 'sellerProfiles', uid),
      {
        uid,
        displayName: form.value.displayName.trim(),
        title: form.value.title?.trim() || null,
        photoUrl: form.value.photoUrl || null,
        whatsapp: normalizedWa.value,
        bio: form.value.bio?.trim() || null,
        instagram: form.value.instagram?.trim().replace(/^@/, '') || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    if (!silent) feedback.value = { text: 'Ficha guardada.', tone: 'success' }
  } catch (err) {
    feedback.value = { text: `No se pudo guardar: ${(err as Error).message}`, tone: 'warning' }
  } finally {
    saving.value = false
  }
}

const initials = computed(() =>
  form.value.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)
</script>

<template>
  <main class="container py-4" style="max-width: 900px">
    <div class="br-app-head">
      <h1 class="h4 mb-0">Mi ficha</h1>
    </div>
    <p class="text-muted small">
      Esto es lo que ve tu cliente cuando le compartís un link. Tu nombre, tu foto y tu WhatsApp —
      el contacto va directo a vos.
    </p>

    <div v-if="feedback" class="alert mb-3" :class="feedback.tone === 'success' ? 'alert-success' : 'alert-warning'">
      {{ feedback.text }}
    </div>

    <p v-if="loading">Cargando…</p>

    <div v-else class="row g-4">
      <div class="col-12 col-lg-7">
        <form class="card card-body" @submit.prevent="save()">
          <div class="mb-3">
            <label class="form-label small" for="pf-name">Tu nombre *</label>
            <input id="pf-name" v-model="form.displayName" type="text" class="form-control" maxlength="80" required />
          </div>

          <div class="mb-3">
            <label class="form-label small" for="pf-title">Cómo te presentás</label>
            <input
              id="pf-title"
              v-model="form.title"
              type="text"
              class="form-control"
              maxlength="80"
              placeholder="Asesor inmobiliario"
            />
          </div>

          <div class="mb-3">
            <label class="form-label small" for="pf-wa">Tu WhatsApp</label>
            <input
              id="pf-wa"
              v-model="form.whatsapp"
              type="tel"
              inputmode="tel"
              class="form-control"
              placeholder="11 5555-5555"
            />
            <div v-if="waPreviewUrl" class="form-text">
              Va a abrir <code>{{ waPreviewUrl }}</code>
              —
              <a :href="waPreviewUrl" target="_blank" rel="noopener">probalo</a>
            </div>
            <div v-else class="form-text text-warning-emphasis">
              Sin tu número, el botón de contacto de tus links abre el WhatsApp de BairesRental.
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small" for="pf-ig">Instagram</label>
            <div class="input-group">
              <span class="input-group-text">@</span>
              <input id="pf-ig" v-model="form.instagram" type="text" class="form-control" placeholder="tuusuario" />
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small" for="pf-bio">Una línea sobre vos</label>
            <textarea id="pf-bio" v-model="form.bio" class="form-control" rows="2" maxlength="280"></textarea>
          </div>

          <div class="mb-3">
            <label class="form-label small" for="pf-photo">Tu foto</label>
            <input id="pf-photo" type="file" accept="image/*" class="form-control" :disabled="uploading" @change="onPhoto" />
            <div class="form-text">{{ uploading ? 'Subiendo…' : 'JPG o PNG, hasta 2 MB. Se guarda sola.' }}</div>
          </div>

          <div class="br-app-form-actions">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando…' : 'Guardar ficha' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Preview de lo que ve el cliente. Vale la pena el espacio: es la
           única forma de que el vendedor entienda que esta pantalla no es
           "su perfil de usuario" sino la portada de su página. -->
      <div class="col-12 col-lg-5">
        <p class="small text-muted mb-2">Así te ve tu cliente:</p>
        <div class="br-brand-preview">
          <div class="br-brand-card">
            <div class="br-brand-avatar">
              <img v-if="form.photoUrl" :src="form.photoUrl" alt="" />
              <span v-else>{{ initials || '—' }}</span>
            </div>
            <div class="br-brand-ident">
              <strong>{{ form.displayName || 'Tu nombre' }}</strong>
              <span v-if="form.title" class="br-brand-title">{{ form.title }}</span>
              <span v-if="form.bio" class="br-brand-bio">{{ form.bio }}</span>
            </div>
          </div>
          <div class="br-brand-cta">
            <i class="bi bi-whatsapp"></i>
            Contactar a {{ form.displayName.split(' ')[0] || 'vos' }}
          </div>
          <p class="br-brand-foot">↑ arriba de la publicación que compartas</p>
        </div>
      </div>
    </div>
  </main>
</template>
