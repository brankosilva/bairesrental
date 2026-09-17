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

const { nombreColeccion } = require('./lib/catalogo');
// El bucket, los content-types y la URL pública viven en lib/storage.js, que es
// lo que usan también los importadores de fichas.
const { TIPO_POR_EXT, subirArchivo } = require('./lib/storage');

const EXTENSIONES = new Set(Object.keys(TIPO_POR_EXT));

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

  console.log(`\nSubiendo ${archivos.length} foto(s) a ${coleccion}/${id}/\n`);

  const urls = [];
  for (const [i, local] of archivos.entries()) {
    const ext = path.extname(local).toLowerCase();
    // Nombre estable y ordenado: 1.jpg, 2.jpg… y cover para la portada de un
    // alquiler, que es como están nombradas las que ya hay en Storage.
    const nombre = cual === 'alquileres' ? `cover${ext}` : `${i + 1}${ext}`;

    urls.push(await subirArchivo(cual, id, nombre, local));
    console.log(`  ✅ ${path.basename(local)} → ${coleccion}/${id}/${nombre}`);
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
