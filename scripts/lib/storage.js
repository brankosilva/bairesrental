// Subidas a Firebase Storage para los scripts de scripts/.
//
// El layout es el que declara nuxt-app/storage.rules — `rentals/<id>/<archivo>`
// y `sales/<id>/<archivo>`, de lectura pública—, así que la URL de descarga
// sirve directo en el catálogo.
//
// `importarDesdeUrl()` es el equivalente de terminal del callable
// `importListingImage` del panel: baja la foto de un CDN ajeno y la guarda acá,
// para que el catálogo no quede colgado de una publicación que mañana dan de
// baja. Si tocás uno, mirá el otro (nuxt-app/functions/src/index.ts).

const path = require('path');

const { getDb } = require('./firestore');
const { nombreColeccion } = require('./catalogo');

const BUCKET = 'bairesrental.firebasestorage.app';

const TIPO_POR_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
};

const EXT_POR_TIPO = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};

function urlPublica(rutaEnStorage) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(rutaEnStorage)}?alt=media`;
}

function bucket() {
  getDb(); // inicializa firebase-admin con las credenciales
  return require('firebase-admin').storage().bucket(BUCKET);
}

// ¿La foto ya está en nuestro Storage, o cuelga del CDN de otro?
function esNuestra(url) {
  return /^https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//i.test((url || '').trim());
}

// Sube un archivo local. Devuelve la URL pública.
async function subirArchivo(cual, id, nombre, rutaLocal) {
  const destino = `${nombreColeccion(cual)}/${id}/${nombre}`;
  const contentType = TIPO_POR_EXT[path.extname(rutaLocal).toLowerCase()];
  await bucket().upload(rutaLocal, { destination: destino, metadata: { contentType } });
  return urlPublica(destino);
}

// Baja una foto de una URL externa y la guarda en nuestro Storage.
// `base` es el nombre sin extensión: la pone el content-type que devuelva el
// origen, no la URL, que muchas veces no tiene ninguna.
async function importarDesdeUrl(cual, id, base, url) {
  const resp = await fetch(url, {
    redirect: 'follow',
    // Sin User-Agent, varios portales devuelven 403 a la descarga directa.
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; BairesRentalBot/1.0)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} al bajar la foto`);

  const contentType = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = EXT_POR_TIPO[contentType];
  if (!ext) throw new Error(`el link no devuelve una imagen (${contentType || 'sin content-type'})`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.byteLength > 15 * 1024 * 1024) throw new Error('la imagen pesa más de 15 MB');

  const destino = `${nombreColeccion(cual)}/${id}/${base}.${ext}`;
  await bucket().file(destino).save(buffer, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return urlPublica(destino);
}

module.exports = { BUCKET, TIPO_POR_EXT, urlPublica, esNuestra, subirArchivo, importarDesdeUrl };
