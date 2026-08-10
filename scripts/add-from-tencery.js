#!/usr/bin/env node
// Converts a Tencery property JSON → BairesRental format and adds to the catalog
// Usage:
//   node scripts/add-from-tencery.js property.json
//   node scripts/add-from-tencery.js property.json --yes
//   node scripts/add-from-tencery.js property.json --dry-run
//   node scripts/add-from-tencery.js property.json --out mapped.json
//   node scripts/add-from-tencery.js property.json --fotos <url>

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'departamentos.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Tipo mapping ────────────────────────────────────────────────────────────

function mapTipo(bedrooms) {
  if (bedrooms === 0) return 'monoambiente';
  if (bedrooms === 1) return '2 ambientes';
  if (bedrooms === 2) return '3 ambientes';
  return '4+ ambientes';
}

// ─── Amenities mapping ────────────────────────────────────────────────────────

const AMENITIES_MAP = {
  'pileta': 'pileta',
  'piscina': 'pileta',
  'gimnasio': 'gimnasio',
  'gym': 'gimnasio',
  'laundry': 'laundry',
  'lavanderia': 'laundry',
  'lavandería': 'laundry',
  'parrilla': 'parrilla',
  'quincho': 'parrilla',
  'barbacoa': 'parrilla',
  'terraza': 'terraza',
  'rooftop': 'terraza',
  'cochera': 'cochera',
  'garaje': 'cochera',
  'garage': 'cochera',
  'estacionamiento': 'cochera',
  'sauna': 'sauna',
  'solarium': 'solárium',
  'solárium': 'solárium',
  'seguridad 24hs': 'seguridad 24hs',
  'seguridad 24 hs': 'seguridad 24hs',
  'vigilancia 24hs': 'seguridad 24hs',
  'portería': 'seguridad 24hs',
  'porteria': 'seguridad 24hs',
  'jacuzzi': 'jacuzzi',
  'lavarropas': 'lavarropas',
};

function extractAmenities(description) {
  const descLower = (description || '').toLowerCase();
  const result = [];
  for (const [keyword, mapped] of Object.entries(AMENITIES_MAP)) {
    if (!result.includes(mapped) && descLower.includes(keyword)) {
      result.push(mapped);
    }
  }
  return result;
}

// ─── minimoMeses ─────────────────────────────────────────────────────────────

function extractMinimoMeses(description) {
  const match =
    description.match(/plazo\s*m[ií]nimo[^:]*:\s*(\d+)\s*mes/i) ||
    description.match(/estad[ií]a\s*m[ií]nima[^:]*:\s*(\d+)\s*mes/i) ||
    description.match(/alquiler\s*m[ií]nimo[:\s]+(\d+)\s*mes/i) ||
    description.match(/m[ií]nimo[:\s]+(\d+)\s*mes/i) ||
    description.match(/(\d+)\s*mes(?:es)?\s*m[ií]nimo/i);
  return match ? parseInt(match[1]) : 1;
}

// ─── Core mapping ────────────────────────────────────────────────────────────

function tenceryToProperty(tencery) {
  const address = (tencery.address || '').trim();
  const barrio = (tencery.neighborhoods?.name || tencery.name || '').trim();
  const tipo = mapTipo(tencery.bedrooms ?? 0);
  const precio = tencery.price || 0;
  const moneda = tencery.currency || 'USD';

  // Disponibilidad
  let disponibilidad = 'disponible';
  let disponibleDesde = '';
  if (tencery.rented_at || tencery.status === 'rented') {
    disponibilidad = 'reservado';
  } else if (tencery.status && tencery.status !== 'published') {
    disponibilidad = 'no disponible';
  }
  if (tencery.available_from) {
    const availDate = new Date(tencery.available_from);
    if (availDate > new Date()) {
      disponibleDesde = tencery.available_from.slice(0, 10);
      disponibilidad = 'reservado';
    }
  }

  const desc = tencery.description || '';
  const descLower = desc.toLowerCase();

  const amueblado = /amoblado|amueblado|mobiliado/i.test(desc);
  const mascotas = tencery.pet_friendly === true
    ? true
    : (/mascota/i.test(desc) && !/(no\s+se\s+aceptan?|sin|no\s+admite)[^\n.]*mascota/i.test(descLower));
  const serviciosIncluidos = tencery.full_package === true;
  const minimoMeses = extractMinimoMeses(desc);
  const amenities = extractAmenities(desc);

  const imagen = tencery.cover_image_url || '';
  const lat = tencery.latitude;
  const lng = tencery.longitude;
  const direccionUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';

  const id = slugify(address) || `tencery-${tencery.id}`;
  const titulo = `${capitalize(tipo)} en ${barrio}`;

  return {
    id,
    titulo,
    barrio,
    tipo,
    precio,
    moneda,
    disponibilidad,
    disponibleDesde,
    amueblado,
    mascotas,
    serviciosIncluidos,
    minimoMeses,
    amenities,
    descripcion: desc,
    imagen,
    fotos: '',
    fichaUrl: '',
    direccion: address,
    direccionUrl,
    whatsappMsg: `Hola! Me interesa el ${tipo} en ${barrio} (${address}). ¿Podría darme más información?`,
    esPropio: false,
  };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function normalizeAddress(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function findDuplicates(catalog, prop) {
  const warnings = [];
  if (catalog.find(p => p.id === prop.id)) warnings.push(`ID "${prop.id}" ya existe`);
  const normAddr = normalizeAddress(prop.direccion);
  if (normAddr) {
    const m = catalog.find(p => p.id !== prop.id && normalizeAddress(p.direccion) === normAddr);
    if (m) warnings.push(`misma dirección que "${m.titulo}" (ID: ${m.id})`);
  }
  if (prop.fotos) {
    const m = catalog.find(p => p.id !== prop.id && (p.fotos || '').trim() === prop.fotos.trim());
    if (m) warnings.push(`mismo link de fotos que "${m.titulo}" (ID: ${m.id})`);
  }
  return warnings;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, a => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('-'));
  const yes = args.includes('--yes') || args.includes('-y');
  const dryRun = args.includes('--dry-run');
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
  const fotosIdx = args.indexOf('--fotos');
  const fotosOverride = fotosIdx >= 0 ? args[fotosIdx + 1] : null;

  if (!filePath) {
    console.error('Uso: node scripts/add-from-tencery.js <tencery.json> [--yes] [--dry-run] [--out mapped.json] [--fotos <url>]');
    process.exit(1);
  }

  let tencery;
  try {
    tencery = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Error al leer el archivo:', e.message);
    process.exit(1);
  }

  const prop = tenceryToProperty(tencery);
  if (fotosOverride) prop.fotos = fotosOverride;

  console.log('\n=== Propiedad mapeada desde Tencery ===');
  console.log(JSON.stringify(prop, null, 2));
  console.log('\n⚠️  Revisá estos campos antes de confirmar:');
  console.log('   - titulo/barrio: ¿es correcto?');
  console.log('   - mascotas: ¿confirmar con el dueño?');
  console.log('   - serviciosIncluidos: ¿incluye luz + wifi?');
  console.log('   - minimoMeses: ¿cuántos meses mínimo?');
  console.log('   - amenities: ¿detectados correctamente?');

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error al leer departamentos.json:', e.message);
    process.exit(1);
  }

  const warnings = findDuplicates(catalog, prop);
  if (warnings.length) {
    console.log('\n⚠️  Posibles duplicados detectados:');
    warnings.forEach(w => console.log('  -', w));
  }

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(prop, null, 2), 'utf8');
    console.log(`\nMapeado guardado en: ${outFile}`);
    console.log(`  node scripts/add-property.js ${outFile}`);
    return;
  }

  if (dryRun) { console.log('\n[dry-run] No se guardaron cambios.'); return; }

  const dupIdx = catalog.findIndex(p => p.id === prop.id);
  if (dupIdx >= 0) {
    const answer = yes ? 's' : await prompt(`\n⚠️  ID "${prop.id}" ya existe. ¿Sobreescribir? (s/N): `);
    if (!/^s/i.test(answer)) { console.log('Cancelado.'); return; }
    catalog[dupIdx] = prop;
    console.log(`\n✅ Actualizado: "${prop.titulo}" (ID: ${prop.id})`);
  } else {
    const answer = yes ? 's' : await prompt('\n¿Agregar al catálogo? (S/n): ');
    if (/^n/i.test(answer)) { console.log('Cancelado.'); return; }
    catalog.unshift(prop);
    console.log(`\n✅ Agregado: "${prop.titulo}" (ID: ${prop.id})`);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('   Archivo guardado: data/departamentos.json');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
