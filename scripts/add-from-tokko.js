#!/usr/bin/env node
// Converts a Tokko Broker property JSON → BairesRental format and adds to the catalog
// Usage:
//   node scripts/add-from-tokko.js property.json
//   node scripts/add-from-tokko.js property.json --yes      (skip confirmation)
//   node scripts/add-from-tokko.js property.json --dry-run  (preview mapping only)
//   node scripts/add-from-tokko.js property.json --out mapped.json (only save mapped JSON)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'departamentos.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();
}

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

function mapTipo(basicInfo, propertyType) {
  if (/casa|house|chalet|quinta/i.test(propertyType || '')) return 'casa';
  const rooms = (basicInfo || []).find(b => b.key === 'room_amount')?.value;
  if (rooms >= 4) return '4+ ambientes';
  if (rooms === 3) return '3 ambientes';
  if (rooms === 2) return '2 ambientes';
  return 'monoambiente';
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
  'solário': 'solárium',
  'seguridad 24hs': 'seguridad 24hs',
  'seguridad 24 hs': 'seguridad 24hs',
  'vigilancia 24hs': 'seguridad 24hs',
  'portería': 'seguridad 24hs',
  'porteria': 'seguridad 24hs',
  'jacuzzi': 'jacuzzi',
  'jacuzzy': 'jacuzzi',
  'lavarropas': 'lavarropas',
};

function mapAmenities(additionals, tags) {
  const items = [
    ...(additionals || []),
    ...(tags || []).map(t => t.name),
  ].map(s => (s || '').toLowerCase().trim());

  const result = [];
  for (const item of items) {
    const mapped = AMENITIES_MAP[item];
    if (mapped && !result.includes(mapped)) result.push(mapped);
  }
  return result;
}

// ─── Core mapping ────────────────────────────────────────────────────────────

function tokkoToProperty(tokko) {
  const data = tokko.data || {};
  const hoggax = tokko.hoggax_data || {};

  const address = (data.address || hoggax.address || '').trim();
  const barrio = ((data.location || hoggax.property_location || '').split('|')[0]).trim();
  const tipo = mapTipo(data.basic_info, data.type);

  // Price — prefer temporary (alquiler temporario) over rent
  const tempPeriods = (data.temporary || {}).periods || [];
  const hoggaxPrices = hoggax.rent_prices || [];
  let precio = 0;
  let moneda = 'USD';

  if (hoggaxPrices.length) {
    precio = hoggaxPrices[0].value || 0;
    moneda = hoggaxPrices[0].currency || 'USD';
  } else if (tempPeriods.length) {
    // e.g. ["Por mes", "USD 550"]
    const priceStr = tempPeriods[0][1] || '';
    const match = priceStr.match(/(USD|ARS)\s*([\d,.]+)/);
    if (match) {
      moneda = match[1];
      precio = parseFloat(match[2].replace(',', ''));
    }
  }

  // Extras
  const allExtras = [
    ...(data.additionals || []),
    ...(data.tags || []).map(t => t.name),
  ];
  const allExtrasLower = allExtras.map(s => (s || '').toLowerCase());

  const amueblado = allExtrasLower.some(a => /amoblado|amueblado|mobiliado/.test(a));
  const mascotas = allExtrasLower.some(a => /mascota/.test(a)) ||
    /mascota/i.test(data.description || '');

  // Amenities
  const amenities = mapAmenities(data.additionals, data.tags);

  // Description
  const descripcion = stripHtml(data.description || '');

  // Images
  const imagen =
    data.pictures?.front_cover_image?.url ||
    (data.pictures?.images || [])[0] ||
    hoggax.picture_url ||
    '';

  // External link
  const fichaUrl = tokko.web_property_url || '';

  // Google Maps
  const lat = data.geolocation?.lat;
  const lng = data.geolocation?.lng;
  const direccionUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : '';

  // Availability
  const disponibilidad = tokko.active !== false ? 'disponible' : 'no disponible';

  // Generate ID — use address slug, fall back to Tokko ID
  const rawId = slugify(address) || `tokko-${data.id || Date.now()}`;
  const id = rawId;

  const titulo = `${capitalize(tipo)} en ${barrio}`;

  return {
    id,
    titulo,
    barrio,
    tipo,
    precio,
    moneda,
    disponibilidad,
    disponibleDesde: '',
    amueblado,
    mascotas,
    serviciosIncluidos: false,
    minimoMeses: 1,
    amenities,
    descripcion,
    imagen,
    fotos: '',
    fichaUrl,
    direccion: address,
    direccionUrl,
    whatsappMsg: `Hola! Me interesa el ${tipo} en ${barrio} (${address}). ¿Podría darme más información?`,
    esPropio: false,
  };
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

  if (!filePath) {
    console.error('Uso: node scripts/add-from-tokko.js <tokko.json> [--yes] [--dry-run] [--out mapped.json]');
    process.exit(1);
  }

  let tokko;
  try {
    tokko = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Error al leer el archivo:', e.message);
    process.exit(1);
  }

  const prop = tokkoToProperty(tokko);

  console.log('\n=== Propiedad mapeada desde Tokko ===');
  console.log(JSON.stringify(prop, null, 2));
  console.log('\n⚠️  Revisá estos campos antes de confirmar:');
  console.log('   - titulo: ¿es descriptivo?');
  console.log('   - barrio: ¿es correcto? (Tokko puede tener errores)');
  console.log('   - mascotas: ¿confirmar con el dueño?');
  console.log('   - serviciosIncluidos: ¿incluye luz + wifi?');
  console.log('   - minimoMeses: ¿cuántos meses mínimo?');
  console.log('   - imagen: URL externa de Tokko CDN (puede expirar si sacan el listado)');

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(prop, null, 2), 'utf8');
    console.log(`\nMapeado guardado en: ${outFile}`);
    console.log('Editá el archivo si necesitás ajustar campos, luego ejecutá:');
    console.log(`  node scripts/add-property.js ${outFile}`);
    return;
  }

  if (dryRun) {
    console.log('\n[dry-run] No se guardaron cambios.');
    return;
  }

  // Load catalog and check for duplicates
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error al leer departamentos.json:', e.message);
    process.exit(1);
  }

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
