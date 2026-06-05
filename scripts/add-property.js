#!/usr/bin/env node
// Validates and adds a BairesRental-format property to data/departamentos.json
// Usage:
//   node scripts/add-property.js property.json
//   node scripts/add-property.js property.json --yes      (skip confirmation)
//   node scripts/add-property.js property.json --update   (overwrite existing ID)
//   node scripts/add-property.js property.json --dry-run  (preview only)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'departamentos.json');

const REQUIRED_FIELDS = ['id', 'titulo', 'barrio', 'tipo', 'precio', 'moneda', 'disponibilidad'];
const VALID_TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa'];
const VALID_MONEDAS = ['USD', 'ARS'];
const VALID_DISPONIBILIDAD = ['disponible', 'reservado', 'no disponible'];
const VALID_AMENITIES = [
  'pileta', 'gimnasio', 'laundry', 'parrilla', 'terraza',
  'cochera', 'sauna', 'solárium', 'seguridad 24hs', 'jacuzzi', 'lavarropas'
];

function validate(prop) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (prop[f] === undefined || prop[f] === null || prop[f] === '') {
      errors.push(`Campo requerido faltante: "${f}"`);
    }
  }
  if (prop.tipo && !VALID_TIPOS.includes(prop.tipo)) {
    errors.push(`tipo inválido: "${prop.tipo}". Válidos: ${VALID_TIPOS.join(', ')}`);
  }
  if (prop.moneda && !VALID_MONEDAS.includes(prop.moneda)) {
    errors.push(`moneda inválida: "${prop.moneda}". Válidas: USD, ARS`);
  }
  if (prop.disponibilidad && !VALID_DISPONIBILIDAD.includes(prop.disponibilidad)) {
    errors.push(`disponibilidad inválida: "${prop.disponibilidad}". Válidas: disponible, reservado, no disponible`);
  }
  if (Array.isArray(prop.amenities)) {
    const invalid = prop.amenities.filter(a => !VALID_AMENITIES.includes(a));
    if (invalid.length) {
      errors.push(`amenities inválidos: [${invalid.join(', ')}]. Válidos: ${VALID_AMENITIES.join(', ')}`);
    }
  }
  return errors;
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, a => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('-'));
  const yes = args.includes('--yes') || args.includes('-y');
  const dryRun = args.includes('--dry-run');
  const forceUpdate = args.includes('--update');

  if (!filePath) {
    console.error('Uso: node scripts/add-property.js <property.json> [--yes] [--update] [--dry-run]');
    process.exit(1);
  }

  let prop;
  try {
    prop = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Error al leer el archivo:', e.message);
    process.exit(1);
  }

  const errors = validate(prop);
  if (errors.length) {
    console.error('\n❌ Errores de validación:');
    errors.forEach(e => console.error('  -', e));
    process.exit(1);
  }

  console.log('\n=== Propiedad a agregar ===');
  console.log(`  ID:             ${prop.id}`);
  console.log(`  Título:         ${prop.titulo}`);
  console.log(`  Barrio:         ${prop.barrio}`);
  console.log(`  Tipo:           ${prop.tipo}`);
  console.log(`  Precio:         ${prop.precio === 0 ? 'Consultar' : prop.moneda + ' ' + prop.precio}`);
  console.log(`  Disponibilidad: ${prop.disponibilidad}`);
  console.log(`  Amueblado:      ${prop.amueblado}`);
  console.log(`  Mascotas:       ${prop.mascotas}`);
  console.log(`  Amenities:      ${(prop.amenities || []).join(', ') || '—'}`);
  console.log(`  Imagen:         ${prop.imagen || '—'}`);
  console.log(`  fichaUrl:       ${prop.fichaUrl || '—'}`);
  console.log(`  Dirección:      ${prop.direccion || '—'}`);
  console.log(`  esPropio:       ${prop.esPropio}`);

  if (dryRun) {
    console.log('\n[dry-run] No se guardaron cambios.');
    return;
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error al leer departamentos.json:', e.message);
    process.exit(1);
  }

  const dupIdx = catalog.findIndex(p => p.id === prop.id);

  if (dupIdx >= 0) {
    const answer = (yes || forceUpdate) ? 's' : await prompt(`\n⚠️  ID "${prop.id}" ya existe. ¿Sobreescribir? (s/N): `);
    if (!/^s/i.test(answer)) { console.log('Cancelado.'); return; }
    catalog[dupIdx] = prop;
    console.log(`\n✅ Actualizado: "${prop.titulo}" (ID: ${prop.id})`);
  } else {
    if (!yes) {
      const answer = await prompt('\n¿Agregar al catálogo? (S/n): ');
      if (/^n/i.test(answer)) { console.log('Cancelado.'); return; }
    }
    catalog.unshift(prop);
    console.log(`\n✅ Agregado: "${prop.titulo}" (ID: ${prop.id})`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('   Archivo guardado: data/departamentos.json');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
