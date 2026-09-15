// Conexión a Firestore para los scripts de scripts/.
//
// Firestore es la fuente de verdad del catálogo desde que el sitio estático se
// dio de baja: lo que se escribe acá es lo que sirve www.bairesrental.com.ar.
// Antes estos scripts editaban data/*.json, que alimentaba el sitio estático.
//
// Credenciales, en orden de prioridad:
//   1. FIREBASE_SERVICE_ACCOUNT — el JSON entero en una variable de entorno.
//      Es el secret que ya usa .github/workflows/deploy-nuxt.yml, así que los
//      workflows no necesitan uno nuevo.
//   2. GOOGLE_APPLICATION_CREDENTIALS — ruta a un archivo de credenciales.
//   3. nuxt-app/serviceAccountKey.json — el archivo local, para correr a mano.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_KEY = path.join(ROOT, 'nuxt-app', 'serviceAccountKey.json');

let db = null;

function credencial(admin) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }
  if (fs.existsSync(LOCAL_KEY)) {
    return admin.credential.cert(JSON.parse(fs.readFileSync(LOCAL_KEY, 'utf8')));
  }
  throw new Error(
    'No encontré credenciales de Firebase.\n' +
    '  Local: tiene que existir nuxt-app/serviceAccountKey.json\n' +
    '  CI:    definí FIREBASE_SERVICE_ACCOUNT con el JSON de la service account',
  );
}

function getDb() {
  if (db) return db;
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp({ credential: credencial(admin) });
  db = admin.firestore();
  return db;
}

module.exports = { getDb };
