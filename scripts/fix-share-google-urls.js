#!/usr/bin/env node
// Reemplaza los direccionUrl rotos de share.google por links de Google Maps
// armados a partir del campo `direccion` de cada propiedad.
//
// Trabajaba sobre data/departamentos.json, que alimentaba el sitio estático.
// Ese sitio se dio de baja: el catálogo vive en Firestore (colección
// `rentals`), que es lo que lee www.bairesrental.com.ar.
//
// Uso: node scripts/fix-share-google-urls.js [--dry-run] [--yes]

const readline = require('readline');

const { leerCatalogo, actualizarCampos } = require('./lib/catalogo');

const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_YES = process.argv.includes('--yes');

function nuevaUrl(p) {
  return p.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion + ', Buenos Aires, Argentina')}`
    : '';
}

async function aplicar(afectadas) {
  const cambios = afectadas.map(p => ({ id: p.id, campos: { direccionUrl: nuevaUrl(p) } }));
  await actualizarCampos('alquileres', cambios);
  console.log(`✓ Actualizadas ${cambios.length} propiedades en Firestore (rentals)\n`);
}

async function main() {
  const lista = await leerCatalogo('alquileres');
  const afectadas = lista.filter(
    p => typeof p.direccionUrl === 'string' && p.direccionUrl.includes('share.google'),
  );

  if (afectadas.length === 0) {
    console.log('No hay links share.google en el catálogo. Nada que hacer.');
    return;
  }

  console.log(`\nSe encontraron ${afectadas.length} propiedad(es) con links share.google:\n`);
  afectadas.forEach(p => {
    console.log(`  ${p.id}`);
    console.log(`    Antes:  ${p.direccionUrl}`);
    console.log(`    Después: ${nuevaUrl(p) || '(vacío — sin campo direccion)'}`);
    console.log('');
  });

  if (DRY_RUN) {
    console.log('Modo --dry-run: no se escribió nada.\n');
    return;
  }

  if (AUTO_YES) {
    await aplicar(afectadas);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await new Promise(r => rl.question('¿Aplicar cambios? (s/N): ', a => { rl.close(); r(a); }));
  if (respuesta.trim().toLowerCase() === 's') await aplicar(afectadas);
  else console.log('Cancelado.\n');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
