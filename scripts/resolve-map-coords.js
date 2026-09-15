#!/usr/bin/env node
// Completa lat/lng en los catálogos para que el mapa del sitio tenga pines.
//
// Las propiedades nunca guardaron coordenadas: solo `direccionUrl`, un link de
// Google Maps. El mapa las parseaba en el cliente con utils/geo.ts, pero eso
// solo funciona si el link ya trae las coordenadas adentro — y la mayoría no.
// Medido sobre los 66 alquileres publicados: 10 con coordenadas, 22 links
// cortos de maps.app.goo.gl (que el navegador no puede resolver por CORS),
// 32 links `?api=1&query=<dirección en texto>` y 2 con el placeholder del
// Obelisco. O sea 10 pines para 66 propiedades.
//
// Este script resuelve eso una sola vez, offline, en dos pasos:
//
//   1. REDIRECT — sigue el link corto de maps.app.goo.gl hasta la URL larga,
//      que sí trae las coordenadas (`/@-34.579,-58.442,17z/`). Es la fuente
//      más confiable: es el pin exacto que eligió quien cargó la propiedad.
//   2. GEOCODING — para las que no tienen coordenadas en ningún lado, busca
//      `direccion + ", Buenos Aires, Argentina"` en Nominatim (OpenStreetMap,
//      el mismo proveedor de los tiles del mapa; gratis, 1 request/segundo).
//
// Por defecto NO escribe nada: deja scripts/temp-coords.json para revisar.
// Conviene mirar las que dicen `geocoding`, sobre todo las direcciones que
// son esquinas ("Dorrego y Luis María Campos") — Nominatim las ubica mal a
// veces. Con --apply escribe lat/lng en Firestore.
//
// Es idempotente: saltea las que ya tienen lat/lng salvo que se pase --force.
//
// Uso:
//   node scripts/resolve-map-coords.js                 # revisar
//   node scripts/resolve-map-coords.js --apply         # escribir
//   node scripts/resolve-map-coords.js --solo=rentals  # una sola colección

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { getDb } = require('./lib/firestore');

const OUT_FILE = path.join(ROOT, 'scripts', 'temp-coords.json');
// Pines puestos a mano, con prioridad sobre todo lo demás. Es la salida para
// las direcciones que ningún geocoder resuelve bien — las esquinas sin altura
// ("Godoy cruz y Santa Fe") y las calles con homónimas en otro barrio.
// Para sacar una coordenada: botón derecho sobre el punto en Google Maps y
// copiar el par que aparece arriba de todo.
const MANUAL_FILE = path.join(ROOT, 'scripts', 'coords-manuales.json');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').split('=')[1];

// Firestore es la única fuente de verdad del catálogo. Antes esto también
// escribía un espejo en data/*.json para el sitio estático; ese sitio y esos
// archivos ya no existen.
const COLECCIONES = [
  { name: 'rentals', oculto: 'no disponible' },
  { name: 'sales', oculto: 'vendido' },
].filter(c => !SOLO || c.name === SOLO);

// Mismos patrones que extractLatLng en nuxt-app/app/utils/geo.ts. Están
// duplicados porque geo.ts es un módulo ES de la app Nuxt y este script es
// CommonJS suelto, como el resto de scripts/ — si cambian allá, cambiarlos acá.
const PATRONES = [
  /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  // ?api=1&query=lat,lng (la coma suele venir como %2C) — el formato que arma
  // scripts/fix-share-google-urls.js.
  /[?&]query=(-?\d+\.?\d*)(?:,|%2C)(-?\d+\.?\d*)/i,
  /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
];

const BA_CENTER = [-34.6037, -58.3816];

function extraerCoords(url) {
  if (!url) return null;
  for (const re of PATRONES) {
    const m = url.match(re);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  }
  return null;
}

// El centro de CABA aparece como placeholder en varias fichas. Si se dibuja,
// quedan todas apiladas sobre el Obelisco y parece un bug del mapa.
function esPlaceholder(c) {
  return c && Math.abs(c[0] - BA_CENTER[0]) < 1e-4 && Math.abs(c[1] - BA_CENTER[1]) < 1e-4;
}

// CABA entra holgadamente en este recuadro. Todas las propiedades del catálogo
// están en la ciudad, así que cualquier coordenada de acá para afuera está mal
// venga de donde venga.
const CABA_BBOX = { latMin: -34.75, latMax: -34.50, lngMin: -58.56, lngMax: -58.32 };
function enCABA([lat, lng]) {
  return lat >= CABA_BBOX.latMin && lat <= CABA_BBOX.latMax && lng >= CABA_BBOX.lngMin && lng <= CABA_BBOX.lngMax;
}

// El chequeo del recuadro corre para TODAS las fuentes, no solo el geocoding.
// Un link corto de Google Maps también puede terminar en el centro geográfico
// de Argentina (-38.4161, -63.6167), que es a donde caen los buscadores cuando
// no encuentran la dirección: `alq-Patricia 8065` (Conde & Céspedes) resolvía
// por redirect a ese punto, en el medio de La Pampa.
function valida(c) {
  return Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && !esPlaceholder(c) && enCABA(c);
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

// Nominatim es quisquilloso con lo que le viene después de la altura: el
// código postal ("C1115AAP"), el barrio pegado al final ("Maipú 740 Centro") o
// un "al" antes del número ("Teodoro García al 2500") le hacen devolver cero
// resultados o matchear la calle entera en vez del portal.
function limpiarDireccion(dir) {
  if (!dir) return '';
  return dir
    .replace(/\bal\s+(?=\d)/gi, '')       // "Teodoro García al 2500" -> "... 2500"
    .replace(/\bC\d{4}[A-Z]{0,3}\b/g, '')  // código postal argentino
    .replace(/^(.*\d+)\b.*$/, '$1')        // corta lo que venga después de la última altura
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Los links share.google caen en una página de búsqueda de Google cuyo `q`
// trae la dirección postal normalizada — más limpia que el campo `direccion`,
// que a veces tiene el barrio pegado o una esquina escrita a mano.
async function direccionDesdeShareGoogle(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const m = res.url.match(/[?&]q=([^&]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

async function resolverRedirect(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    return extraerCoords(res.url);
  } catch {
    return null;
  }
}

// Nominatim pide un User-Agent identificable y como máximo 1 request/segundo.
// Ver https://operations.osmfoundation.org/policies/nominatim/
async function geocodificar(direccion) {
  const q = `${direccion}, Ciudad Autónoma de Buenos Aires, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'BairesRental/1.0 (bairesrentalok@gmail.com)' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.length) return null;
    return { coords: [parseFloat(json[0].lat), parseFloat(json[0].lon)], etiqueta: json[0].display_name };
  } catch {
    return null;
  }
}

async function resolverUno(p, manuales) {
  const base = { id: p.id, direccion: p.direccion || '', direccionUrl: p.direccionUrl || '' };

  const aMano = manuales[p.id];
  if (Array.isArray(aMano) && aMano.length === 2) {
    return { ...base, coords: [Number(aMano[0]), Number(aMano[1])], origen: 'manual', revisar: false };
  }

  const yaEnLink = extraerCoords(p.direccionUrl);
  if (valida(yaEnLink)) return { ...base, coords: yaEnLink, origen: 'link', revisar: false };

  if (p.direccionUrl && /goo\.gl/.test(p.direccionUrl)) {
    const resuelto = await resolverRedirect(p.direccionUrl);
    if (valida(resuelto)) return { ...base, coords: resuelto, origen: 'redirect', revisar: false };
  }

  // Dos candidatos para geocodificar, en orden: la dirección normalizada que
  // devuelve el redirect de share.google, y el campo `direccion` de la ficha.
  // El redirect suele ser mejor ("Maipú 740, C1006ACJ" en vez de "Maipú 740
  // Centro"), pero a veces devuelve una esquina donde la ficha tenía la altura
  // exacta ("Paraguay & Sánchez de Bustamante" vs "sanchez de bustamante
  // 1300") o un nombre que Nominatim no conoce ("Gral. Deheza" vs "Deheza").
  // Por eso se prueban los dos y gana el primero que resuelva.
  const candidatos = [];
  if (/share\.google/.test(p.direccionUrl || '')) {
    const delRedirect = await direccionDesdeShareGoogle(p.direccionUrl);
    if (delRedirect) candidatos.push(limpiarDireccion(delRedirect));
  }
  candidatos.push(limpiarDireccion(p.direccion));

  const aProbar = [...new Set(candidatos.filter(Boolean))];
  if (!aProbar.length) return { ...base, coords: null, origen: 'sin-direccion', revisar: true };

  let geo = null;
  let direccion = aProbar[0];
  for (const cand of aProbar) {
    await dormir(1100);
    const r = await geocodificar(cand);
    if (r && valida(r.coords)) {
      geo = r;
      direccion = cand;
      break;
    }
  }
  if (!geo) {
    return { ...base, coords: null, origen: 'geocoding-fallido', revisar: true, consultado: aProbar.join(' | ') };
  }

  // Las esquinas ("Dorrego y Luis María Campos") y las direcciones sin altura
  // son las que Nominatim resuelve peor: se marcan para mirarlas a mano.
  // Las esquinas ("Dorrego y Luis María Campos") no las resuelve ningún
  // geocoder de direcciones: necesitan pin a mano.
  const esEsquina = /\s(y|&)\s/i.test(p.direccion || '');
  // Nominatim arranca la etiqueta con la altura cuando matcheó la dirección
  // exacta. Si arranca con el nombre de la calle, matcheó la calle entera y
  // el pin puede caer a varias cuadras del edificio.
  const soloCalle = !/^\d/.test(geo.etiqueta || '');
  const motivo = esEsquina
    ? 'es una esquina — Nominatim no las ubica bien'
    : soloCalle
      ? 'matcheó la calle, no la altura — el pin puede estar a cuadras'
      : 'geocodificada desde el texto';
  return {
    ...base,
    coords: geo.coords,
    origen: 'geocoding',
    consultado: direccion,
    etiqueta: geo.etiqueta,
    revisar: true,
    precision: soloCalle ? 'calle' : 'altura',
    motivo,
  };
}

async function main() {
  const db = getDb();

  const manuales = fs.existsSync(MANUAL_FILE) ? JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8')) : {};
  if (Object.keys(manuales).length) {
    console.log(`Pines manuales cargados: ${Object.keys(manuales).length} (${path.relative(ROOT, MANUAL_FILE)})`);
  }

  const salida = {};
  for (const col of COLECCIONES) {
    const snap = await db.collection(col.name).get();
    const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const visibles = todas.filter(p => p.disponibilidad !== col.oculto);
    const pendientes = visibles.filter(p => FORCE || typeof p.lat !== 'number' || typeof p.lng !== 'number');

    console.log(`\n${col.name}: ${todas.length} docs, ${visibles.length} visibles, ${pendientes.length} sin coordenadas`);
    if (!pendientes.length) {
      salida[col.name] = [];
      continue;
    }

    const resultados = [];
    for (const [i, p] of pendientes.entries()) {
      const r = await resolverUno(p, manuales);
      resultados.push(r);
      const marca = r.coords ? (r.revisar ? '?' : '✓') : '✗';
      process.stdout.write(`  ${marca} [${i + 1}/${pendientes.length}] ${r.id} · ${r.direccion || '(sin dirección)'} · ${r.origen}\n`);
    }
    salida[col.name] = resultados;
  }

  const resumen = Object.entries(salida).map(([name, rs]) => ({
    coleccion: name,
    resueltas: rs.filter(r => r.coords).length,
    exactas: rs.filter(r => r.coords && !r.revisar).length,
    soloCalle: rs.filter(r => r.precision === 'calle').length,
    sinResolver: rs.filter(r => !r.coords).length,
  }));

  fs.writeFileSync(OUT_FILE, JSON.stringify({ generado: new Date().toISOString(), resumen, resultados: salida }, null, 2));

  console.log('\n── Resumen ──');
  resumen.forEach(r =>
    console.log(`  ${r.coleccion}: ${r.resueltas} resueltas · ${r.exactas} exactas (link/redirect/manual) · ${r.soloCalle} a nivel de calle · ${r.sinResolver} sin resolver`),
  );
  const aMano = Object.values(salida).flat().filter(r => !r.coords || r.precision === 'calle');
  if (aMano.length) {
    console.log(`\nNecesitan un pin a mano en ${path.relative(ROOT, MANUAL_FILE)} (${aMano.length}):`);
    aMano.forEach(r => console.log(`  "${r.id}": [lat, lng],   // ${r.direccion || '(sin dirección)'}${r.motivo ? ' — ' + r.motivo : ''}`));
  }
  console.log(`\nDetalle en ${path.relative(ROOT, OUT_FILE)}`);

  if (!APPLY) {
    console.log('\nNo se escribió nada. Revisá el archivo (sobre todo las de origen `geocoding`)');
    console.log('y volvé a correr con --apply para guardar.\n');
    return;
  }

  for (const col of COLECCIONES) {
    const conCoords = (salida[col.name] || []).filter(r => r.coords);
    if (!conCoords.length) continue;

    // Firestore, de a lotes (el máximo de un batch es 500 escrituras).
    for (let i = 0; i < conCoords.length; i += 400) {
      const batch = db.batch();
      for (const r of conCoords.slice(i, i + 400)) {
        batch.update(db.collection(col.name).doc(r.id), { lat: r.coords[0], lng: r.coords[1] });
      }
      await batch.commit();
    }
    console.log(`\n✅ ${col.name}: ${conCoords.length} docs actualizados en Firestore`);
  }
  console.log('');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
