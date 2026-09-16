#!/usr/bin/env node
// Valida y agrega una propiedad en formato BairesRental al catálogo de
// alquileres (colección `rentals` de Firestore).
//
// Escribía en data/departamentos.json, que alimentaba el sitio estático. Ese
// sitio se dio de baja: ahora www.bairesrental.com.ar es la app de nuxt-app/,
// que lee Firestore. Guardar en el JSON no publicaba nada.
//
// Usage:
//   node scripts/add-property.js property.json
//   node scripts/add-property.js property.json --yes      (skip confirmation)
//   node scripts/add-property.js property.json --update   (overwrite existing ID)
//   node scripts/add-property.js property.json --dry-run  (preview only)

const fs = require('fs');
const readline = require('readline');

const { leerCatalogo, guardarPropiedad } = require('./lib/catalogo');

// Mínimo publicable. Es la misma lista que exige el formulario del panel
// (nuxt-app/app/pages/app/rentals/[id].vue) — la regla es del catálogo, no de
// la puerta por la que entra la propiedad. `imagen` es la portada del card,
// `fotos` el link a la ficha/álbum y `direccionUrl` el link de Maps, que
// además es de donde sale el pin del mapa si no hay lat/lng.
const REQUIRED_FIELDS = [
  'id', 'titulo', 'barrio', 'tipo', 'precio', 'moneda', 'disponibilidad',
  'descripcion', 'imagen', 'fotos', 'direccion', 'direccionUrl',
];
const VALID_TIPOS = ['monoambiente', '2 ambientes', '3 ambientes', '4+ ambientes', 'casa'];
const VALID_MONEDAS = ['USD', 'ARS'];
const VALID_DISPONIBILIDAD = ['disponible', 'reservado', 'no disponible'];
const VALID_AMENITIES = [
  'pileta', 'gimnasio', 'laundry', 'parrilla', 'terraza',
  'cochera', 'sauna', 'solárium', 'seguridad 24hs', 'jacuzzi', 'lavarropas'
];

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

  const fotos = (prop.fotos || '').trim();
  if (fotos) {
    const fotosMatch = catalog.find(p => p.id !== prop.id && (p.fotos || '').trim() === fotos);
    if (fotosMatch) {
      warnings.push(`mismo link de fotos que "${fotosMatch.titulo}" (ID: ${fotosMatch.id})`);
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
  // El 0 pasa el chequeo de arriba (no es '' ni null) y el catálogo lo muestra
  // como "Consultar precio": una publicación sin precio. Ya no se carga así.
  if (!(Number(prop.precio) > 0)) {
    errors.push(`precio inválido: "${prop.precio}". Debe ser un número mayor a 0`);
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

  let catalog;
  try {
    catalog = await leerCatalogo('alquileres');
  } catch (e) {
    console.error('Error al leer el catálogo de Firestore:', e.message);
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

  const existente = catalog.find(p => p.id === prop.id);

  // `--yes` es "no me preguntes lo de rutina", no "pisá lo que haya". Los
  // comandos /agregar-depto corren siempre con --yes y sin una terminal donde
  // responder, así que un slug repetido por casualidad reemplazaba en silencio
  // la propiedad que ya estaba. Reemplazar ahora se pide con --update.
  if (existente && !forceUpdate) {
    if (yes) {
      console.error(`\n❌ El ID "${prop.id}" ya existe: "${existente.titulo}".`);
      console.error('   Cambiá el `id`, o pasá --update si la idea es reemplazar esa propiedad.');
      process.exit(1);
    }
    const answer = await prompt(`\n⚠️  ID "${prop.id}" ya existe ("${existente.titulo}"). ¿Sobreescribir? (s/N): `);
    if (!/^s/i.test(answer)) { console.log('Cancelado.'); return; }
  } else if (!existente && !yes) {
    const answer = await prompt('\n¿Agregar al catálogo? (S/n): ');
    if (/^n/i.test(answer)) { console.log('Cancelado.'); return; }
  }

  await guardarPropiedad('alquileres', prop);
  console.log(`\n✅ ${existente ? 'Actualizado' : 'Agregado'}: "${prop.titulo}" (ID: ${prop.id})`);
  console.log('   Guardado en Firestore (rentals) — ya está publicado en el sitio.');
}

// También se usa como módulo: add-from-ficha.js importa validate()/findDuplicates()
// para que una carga por URL pase por la misma validación que una carga a mano.
if (require.main === module) {
  main().catch(err => { console.error('Error:', err.message); process.exit(1); });
}

module.exports = { validate, findDuplicates, prompt, VALID_TIPOS, VALID_AMENITIES };
