// Uploads go through the `uploadListingImage` Cloud Function rather than
// a direct client Storage write — storage.rules can't verify a seller
// owns the target listing (that needs a `firestore.get()` cross-service
// call, confirmed broken for this project's bucket; see the comment at
// the top of storage.rules), so the ownership check happens server-side
// via the Admin SDK instead. See functions/src/index.ts.
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
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const { getFirebaseApp } = await import('../firebase/client')
  const uploadListingImage = httpsCallable<
    { collectionName: string; propertyId: string; fileName: string; contentType: string; dataBase64: string },
    { url: string }
  >(getFunctions(getFirebaseApp(), 'southamerica-east1'), 'uploadListingImage')

  const { data } = await uploadListingImage({
    collectionName,
    propertyId,
    fileName,
    contentType: file.type || 'image/jpeg',
    dataBase64,
  })
  return data.url
}
