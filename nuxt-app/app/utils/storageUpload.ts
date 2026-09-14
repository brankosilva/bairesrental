// Ported from app/src/data/storageUpload.ts — same base64-encode-then-call
// pattern against the existing, unchanged `uploadListingImage` Cloud
// Function (storage.rules can't verify listing ownership server-side, see
// the comment at the top of that file, so the check happens in the
// function via the Admin SDK instead). The one real change: the Functions
// instance is sourced from nuxt-vuefire's canonical Firebase app
// (`useFirebaseApp()`) instead of a second hand-rolled singleton.
//
// `useFirebaseApp` is imported explicitly from '#imports' (Nuxt's virtual
// auto-import module) rather than relied on via the auto-import transform,
// since this is a plain utils file, not a .vue/page/composable — same
// pattern nuxt-vuefire's own runtime composables.js uses internally.
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useFirebaseApp } from '#imports'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // strip the "data:<type>;base64," prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadPropertyImage(
  collectionName: 'rentals' | 'sales',
  propertyId: string,
  fileName: string,
  file: File,
): Promise<string> {
  const dataBase64 = await fileToBase64(file)
  const uploadListingImage = httpsCallable<
    { collectionName: string; propertyId: string; fileName: string; contentType: string; dataBase64: string },
    { url: string }
  >(getFunctions(useFirebaseApp(), 'southamerica-east1'), 'uploadListingImage')

  const { data } = await uploadListingImage({
    collectionName,
    propertyId,
    fileName,
    contentType: file.type || 'image/jpeg',
    dataBase64,
  })
  return data.url
}
