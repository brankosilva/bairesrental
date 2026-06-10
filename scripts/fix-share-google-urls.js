#!/usr/bin/env node
// Replaces broken share.google direccionUrl links with correct Google Maps search URLs
// built from each property's direccion field.
// Usage: node scripts/fix-share-google-urls.js [--dry-run] [--yes]

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'departamentos.json');
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_YES = process.argv.includes('--yes');

const lista = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const afectadas = lista
  .map((p, i) => ({ p, i }))
  .filter(({ p }) => typeof p.direccionUrl === 'string' && p.direccionUrl.includes('share.google'));

if (afectadas.length === 0) {
  console.log('No hay links share.google en el catálogo. Nada que hacer.');
  process.exit(0);
}

console.log(`\nSe encontraron ${afectadas.length} propiedad(es) con links share.google:\n`);

afectadas.forEach(({ p }) => {
  const nueva = p.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion + ', Buenos Aires, Argentina')}`
    : '';
  console.log(`  ${p.id}`);
  console.log(`    Antes:  ${p.direccionUrl}`);
  console.log(`    Después: ${nueva || '(vacío — sin campo direccion)'}`);
  console.log('');
});

if (DRY_RUN) {
  console.log('Modo --dry-run: no se escribió nada.\n');
  process.exit(0);
}

function aplicar() {
  let cambiadas = 0;
  const resultado = lista.map(p => {
    if (typeof p.direccionUrl === 'string' && p.direccionUrl.includes('share.google')) {
      if (p.direccion) {
        cambiadas++;
        return {
          ...p,
          direccionUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion + ', Buenos Aires, Argentina')}`
        };
      } else {
        return { ...p, direccionUrl: '' };
      }
    }
    return p;
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(resultado, null, 2), 'utf8');
  console.log(`✓ Actualizadas ${cambiadas} propiedades en data/departamentos.json\n`);
}

if (AUTO_YES) {
  aplicar();
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('¿Aplicar cambios? (s/N): ', answer => {
  rl.close();
  if (answer.trim().toLowerCase() === 's') {
    aplicar();
  } else {
    console.log('Cancelado.\n');
  }
});
