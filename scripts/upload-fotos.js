#!/usr/bin/env node
// Sube fotos locales a Firebase Storage y devuelve las URLs públicas para
// pegar en el campo `imagen` (alquileres) o `fotos` (ventas).
//
// Reemplaza la vieja convención de guardar las fotos en images/<id>/ del sitio
// estático. El layout en Storage es el que declara nuxt-app/storage.rules:
//   rentals/<id>/<archivo>   ·   sales/<id>/<archivo>
// y son de lectura pública (`allow read: if true`), así que la URL de descarga
// sirve directo en el catálogo.
//
// Uso:
//   node scripts/upload-fotos.js alquileres <id> foto.jpg
//   node scripts/upload-fotos.js ventas <id> 1.jpg 2.jpg 3.jpg
//   node scripts/upload-fotos.js ventas <id> ./carpeta-de-fotos
//
// En ventas el orden de los argumentos es el orden del array `fotos`, y la
// primera es la portada. Si se pasa una carpeta, se ordenan por nombre.

const fs = require('fs');
const path = require('path');

const { getDb } = require('./lib/firestore');
const { nombreColeccion } = require('./lib/catalogo');

const BUCKET = 'bairesrental.firebasestorage.app';
const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const TIPOS = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
};

function urlPublica(rutaEnStorage) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(rutaEnStorage)}?alt=media`;
}

function expandir(entradas) {
  const archivos = [];
  for (const e of entradas) {
    if (fs.existsSync(e) && fs.statSync(e).isDirectory()) {
      const dentro = fs.readdirSync(e)
        .filter(f => EXTENSIONES.has(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
        .map(f => path.join(e, f));
      archivos.push(...dentro);
    } else {
      archivos.push(e);
    }
  }
  return archivos;
}

async function main() {
  const [cual, id, ...entradas] = process.argv.slice(2);

  if (!cual || !id || !entradas.length) {
    console.error('Uso: node scripts/upload-fotos.js <alquileres|ventas> <id> <foto...|carpeta>');
    process.exit(1);
  }

  let coleccion;
  try {
    coleccion = nombreColeccion(cual);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const archivos = expandir(entradas);
  for (const f of archivos) {
    if (!fs.existsSync(f)) { console.error(`No existe el archivo: ${f}`); process.exit(1); }
    if (!EXTENSIONES.has(path.extname(f).toLowerCase())) {
      console.error(`Extensión no soportada: ${f} (usá ${[...EXTENSIONES].join(', ')})`);
      process.exit(1);
    }
  }

  getDb(); // inicializa firebase-admin con las credenciales
  const bucket = require('firebase-admin').storage().bucket(BUCKET);

  console.log(`\nSubiendo ${archivos.length} foto(s) a ${coleccion}/${id}/\n`);

  const urls = [];
  for (const [i, local] of archivos.entries()) {
    const ext = path.extname(local).toLowerCase();
    // Nombre estable y ordenado: 1.jpg, 2.jpg… y cover para la portada de un
    // alquiler, que es como están nombradas las que ya hay en Storage.
    const nombre = cual === 'alquileres' ? `cover${ext}` : `${i + 1}${ext}`;
    const destino = `${coleccion}/${id}/${nombre}`;

    await bucket.upload(local, { destination: destino, metadata: { contentType: TIPOS[ext] } });
    const url = urlPublica(destino);
    urls.push(url);
    console.log(`  ✅ ${path.basename(local)} → ${destino}`);
  }

  console.log('\n=== URLs para el catálogo ===');
  if (cual === 'alquileres') {
    console.log(`"imagen": ${JSON.stringify(urls[0])}`);
    if (urls.length > 1) console.log(`(se subieron ${urls.length}, pero un alquiler usa una sola portada)`);
  } else {
    console.log(`"fotos": ${JSON.stringify(urls, null, 2)}`);
  }
  console.log('');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
