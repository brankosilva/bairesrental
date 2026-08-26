#!/usr/bin/env node
// Validates and adds a BairesRental sale-property to data/ventas.json
// Usage:
//   node scripts/add-property-venta.js property.json
//   node scripts/add-property-venta.js property.json --yes      (skip confirmation)
//   node scripts/add-property-venta.js property.json --update   (overwrite existing ID)
//   node scripts/add-property-venta.js property.json --dry-run  (preview only)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'ventas.json');

const REQUIRED_FIELDS = ['id', 'titulo', 'barrio', 'tipo', 'precio', 'moneda', 'disponibilidad', 'fotos', 'superficie'];
const VALID_TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa', 'PH'];
const VALID_MONEDAS = ['USD', 'ARS'];
const VALID_DISPONIBILIDAD = ['disponible', 'reservado', 'vendido'];
const VALID_AMENITIES = [
  'pileta', 'gimnasio', 'laundry', 'parrilla', 'terraza',
  'cochera', 'sauna', 'solárium', 'seguridad 24hs', 'jacuzzi', 'lavarropas'
];
const MAX_FOTOS = 20;

function normalizeAddress(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicates(catalog, prop) {
  const warnings = [];

  const idMatch = catalog.find(p => p.id === prop.id);
  if (idMatch) {
    warnings.push(`ID "${prop.id}" ya existe: "${idMatch.titulo}"`);
  }

  const normAddr = normalizeAddress(prop.direccion);
  if (normAddr) {
    const addrMatch = catalog.find(p => p.id !== prop.id && normalizeAddress(p.direccion) === normAddr);
    if (addrMatch) {
      warnings.push(`misma dirección que "${addrMatch.titulo}" (ID: ${addrMatch.id}): "${addrMatch.direccion}"`);
    }
  }

  return warnings;
}

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
    errors.push(`disponibilidad inválida: "${prop.disponibilidad}". Válidas: disponible, reservado, vendido`);
  }
  if (prop.superficie !== undefined && (typeof prop.superficie !== 'number' || prop.superficie <= 0)) {
    errors.push(`superficie inválida: "${prop.superficie}". Debe ser un número mayor a 0 (m²)`);
  }
  if (Array.isArray(prop.amenities)) {
    const invalid = prop.amenities.filter(a => !VALID_AMENITIES.includes(a));
    if (invalid.length) {
      errors.push(`amenities inválidos: [${invalid.join(', ')}]. Válidos: ${VALID_AMENITIES.join(', ')}`);
    }
  }
  if (!Array.isArray(prop.fotos)) {
    errors.push('"fotos" debe ser un array de URLs/paths');
  } else {
    if (prop.fotos.length < 1) errors.push('"fotos" debe tener al menos 1 imagen');
    if (prop.fotos.length > MAX_FOTOS) errors.push(`"fotos" tiene ${prop.fotos.length} imágenes, el máximo es ${MAX_FOTOS}`);
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
    console.error('Uso: node scripts/add-property-venta.js <property.json> [--yes] [--update] [--dry-run]');
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

  console.log('\n=== Propiedad en venta a agregar ===');
  console.log(`  ID:             ${prop.id}`);
  console.log(`  Título:         ${prop.titulo}`);
  console.log(`  Barrio:         ${prop.barrio}`);
  console.log(`  Tipo:           ${prop.tipo}`);
  console.log(`  Precio:         ${prop.precio === 0 ? 'Consultar' : prop.moneda + ' ' + prop.precio}`);
  console.log(`  Disponibilidad: ${prop.disponibilidad}`);
  console.log(`  Superficie:     ${prop.superficie ? prop.superficie + ' m²' : '—'}`);
  console.log(`  Ambientes:      ${prop.ambientes || '—'}`);
  console.log(`  Baños:          ${prop.banios || '—'}`);
  console.log(`  Antigüedad:     ${prop.antiguedad || '—'}`);
  console.log(`  Expensas:       ${prop.expensas ? 'ARS ' + prop.expensas : '—'}`);
  console.log(`  Apto crédito:   ${prop.aptoCredito ? 'Sí' : 'No'}`);
  console.log(`  Amueblado:      ${prop.amueblado ? 'Sí' : 'No'}`);
  console.log(`  Amenities:      ${(prop.amenities || []).join(', ') || '—'}`);
  console.log(`  Fotos:          ${prop.fotos.length} imagen(es)`);
  console.log(`  fichaUrl:       ${prop.fichaUrl || '—'}`);
  console.log(`  Dirección:      ${prop.direccion || '—'}`);
  console.log(`  esPropio:       ${prop.esPropio}`);

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error al leer ventas.json:', e.message);
    process.exit(1);
  }

  const warnings = findDuplicates(catalog, prop);
  if (warnings.length) {
    console.log('\n⚠️  Posibles duplicados detectados:');
    warnings.forEach(w => console.log('  -', w));
  }

  if (dryRun) {
    console.log('\n[dry-run] No se guardaron cambios.');
    return;
  }

  const dupIdx = catalog.findIndex(p => p.id === prop.id);

  if (dupIdx >= 0) {
    const answer = (yes || forceUpdate) ? 's' : await prompt(`\n⚠️  ID "${prop.id}" ya existe. ¿Sobreescribir? (s/N): `);
    if (!/^s/i.test(answer)) { console.log('Cancelado.'); return; }
    catalog[dupIdx] = prop;
    console.log(`\n✅ Actualizado: "${prop.titulo}" (ID: ${prop.id})`);
  } else {
    if (!yes) {
      const answer = await prompt('\n¿Agregar al catálogo de ventas? (S/n): ');
      if (/^n/i.test(answer)) { console.log('Cancelado.'); return; }
    }
    catalog.unshift(prop);
    console.log(`\n✅ Agregado: "${prop.titulo}" (ID: ${prop.id})`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('   Archivo guardado: data/ventas.json');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
