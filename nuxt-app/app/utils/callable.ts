// Acceso a los callables de nuxt-app/functions/. La región no es la default:
// las functions se declaran con setGlobalOptions({ region: 'southamerica-east1' }),
// así que pedirle a getFunctions() la región por defecto apunta a un endpoint
// que no existe y falla como "internal".
//
// `useFirebaseApp` se importa explícito de '#imports' (el módulo virtual de
// auto-imports de Nuxt) porque este es un archivo plano de utils, no un .vue ni
// un composable — mismo criterio que storageUpload.ts.
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useFirebaseApp } from '#imports'

const REGION = 'southamerica-east1'

export function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(getFunctions(useFirebaseApp(), REGION), name)
}
