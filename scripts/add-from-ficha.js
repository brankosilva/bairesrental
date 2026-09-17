#!/usr/bin/env node
// Carga una propiedad de alquiler al catálogo a partir de la URL de la ficha
// pública que comparte la inmobiliaria. Una sola URL alcanza. Entiende dos:
//
//   ficha.info/p/HASH            → el "link para colegas" de Tokko. La ficha
//                                  trae adentro el mismo JSON de Tokko que
//                                  add-from-tokko.js recibe pegado a mano, así
//                                  que se reusa ese mapeo.
//   www.fichaprop.tech/ficha/ID  → el equivalente de Tencery. Los datos salen
//                                  de su API (ver lib/fichaprop.js) con el
//                                  schema que ya mapea add-from-tencery.js.
//
// En los dos casos acá solo se completa lo que la ficha permite afinar, y la
// foto de portada se copia a nuestro Storage antes de guardar: el CDN de la
// otra inmobiliaria se cae el día que dan de baja la publicación.
//
// Uso:
//   node scripts/add-from-ficha.js <url>
//   node scripts/add-from-ficha.js <url> --dry-run          (solo mostrar el mapeo)
//   node scripts/add-from-ficha.js <url> --out mapped.json  (guardar para editar a mano)
//   node scripts/add-from-ficha.js <url> --yes              (sin preguntar)
//   node scripts/add-from-ficha.js <url> --update           (pisar un ID existente)
//
// Overrides de los campos que la ficha no dice (o dice mal):
//   --id alq-07       --precio 550        --minimo 3   (--id tenc-03 en Tencery)
//   --mascotas        --sin-mascotas      --servicios       --sin-servicios
//   --barrio "..."    --titulo "..."      --propio
//   --desde 2026-09-01                    --imagen <url>

const fs = require('fs');

const { leerCatalogo, guardarPropiedad } = require('./lib/catalogo');
const { fetchFicha, urlCanonica, esUrlDeFicha, esDisponibleSegunTokko, estadoDeFicha, MI_INMOBILIARIA_TOKKO } = require('./lib/ficha');
const { esUrlDeFichaprop, urlCanonica: urlCanonicaFichaprop, fetchFichaprop } = require('./lib/fichaprop');
const { esNuestra, importarDesdeUrl } = require('./lib/storage');
const { tokkoToProperty } = require('./add-from-tokko');
const { tenceryToProperty } = require('./add-from-tencery');
const { validate, findDuplicates, prompt } = require('./add-property');

// ─── ID: el próximo `<serie>-NN` libre ───────────────────────────────────────

// Cada ficha tiene su serie: `alq-NN` para lo que entra por ficha.info (Tokko)
// y `tenc-NN` para lo de fichaprop.tech (Tencery), así el id dice de dónde
// salió la propiedad. Los números en uso salen de los docs cuyo id es
// exactamente `<serie>-<dígitos>`; los históricos sucios (`alq-8315-`,
// `alq-PEDRO6767`, `alq-marie-11`) no matchean y quedan afuera del conteo.
// Se rellenan los huecos: si están el 01..05 y el 07, el próximo es el 06.
function proximoId(catalogo, serie) {
  const re = new RegExp(`^${serie}-(\\d+)$`);
  const usados = new Set();
  for (const p of catalogo) {
    const m = re.exec(p.id || '');
    if (m) usados.add(parseInt(m[1], 10));
  }
  let n = 1;
  while (usados.has(n)) n++;
  return `${serie}-${String(n).padStart(2, '0')}`;
}

// ─── Fecha de disponibilidad ─────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function aIso(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Sin año explícito se toma la primera vez que cae esa fecha a partir de cuándo
// se publicó la ficha, no a partir de hoy: una ficha de agosto que dice
// "disponible desde el 01 de septiembre" habla del septiembre siguiente a su
// publicación, aunque la estemos leyendo un año después.
function anioProbable(mes, dia, referencia) {
  const ref = referencia instanceof Date && !isNaN(referencia) ? referencia : new Date();
  const anio = ref.getFullYear();
  return new Date(anio, mes - 1, dia) < new Date(anio, ref.getMonth(), ref.getDate())
    ? anio + 1
    : anio;
}

// `edited_ficha.created_at` viene ISO; `property.created_at`, como "11-08-2026".
function fechaDePublicacion(ficha) {
  const iso = ficha.edited_ficha?.created_at;
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d)) return d;
  }
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ficha.property?.created_at || '');
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return new Date();
}

function extraerDisponibleDesde(texto, referencia) {
  const desde = '(?:desde|a\\s+partir\\s+del?)\\s+(?:el\\s+)?';

  const textual = new RegExp(`disponible\\s+${desde}(\\d{1,2})\\s+de\\s+([a-záéíóúñ]+)(?:\\s+(?:de[l]?\\s+)?(\\d{4}))?`, 'i');
  let m = texto.match(textual);
  if (m) {
    const mes = MESES.findIndex(x => x === m[2].toLowerCase()) + 1;
    const dia = parseInt(m[1], 10);
    if (mes > 0) return aIso(m[3] ? parseInt(m[3], 10) : anioProbable(mes, dia, referencia), mes, dia);
  }

  const numerica = new RegExp(`disponible\\s+${desde}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?`, 'i');
  m = texto.match(numerica);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (mes >= 1 && mes <= 12) {
      let anio = m[3] ? parseInt(m[3], 10) : anioProbable(mes, dia, referencia);
      if (anio < 100) anio += 2000;
      return aIso(anio, mes, dia);
    }
  }

  return '';
}

// ─── Mapeo ───────────────────────────────────────────────────────────────────

// El objeto `property` de la ficha tiene la misma forma que el `data` del JSON
// de Tokko, así que el mapeo pesado ya está hecho. Acá se corrige lo que el
// importador de Tokko no puede saber y la ficha sí.
function fichaToProperty(ficha) {
  const property = ficha.property || {};
  const avisos = [];

  const prop = tokkoToProperty({ data: property, active: property.active });

  // La ficha es justamente el álbum de fotos para colegas. Va en `fotos`;
  // `fichaUrl` queda vacío, que es solo para links directos de Airbnb/Booking.
  prop.fotos = ficha.edited_ficha?.url ? urlCanonica(ficha.edited_ficha.url) : '';

  // `edited_ficha.description` es el mismo texto ya en plano; el `description`
  // de `property` viene en HTML y al limpiarlo quedan espacios colgando.
  const descripcion = (ficha.edited_ficha?.description || '').trim();
  if (descripcion) prop.descripcion = descripcion;

  // Pines del mapa. Sin esto habría que pasar después por resolve-map-coords.js.
  const lat = parseFloat(property.geolocation?.lat);
  const lng = parseFloat(property.geolocation?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    prop.lat = lat;
    prop.lng = lng;
  }

  const texto = `${prop.descripcion}\n${prop.titulo}`;

  // Las fichas vienen con `tags: []` y sin `additionals`, así que la detección
  // por tags de tokkoToProperty() siempre daría false. Acá manda la descripción.
  if (/amoblad|amueblad|equipad/i.test(texto)) prop.amueblado = true;

  // Estado real según Tokko, que distingue "Alquilada"/"Tasación" de un simple
  // inactivo. Ver la advertencia de esDisponibleSegunTokko().
  const { status, company } = estadoDeFicha(ficha);
  const disponibleEnTokko = esDisponibleSegunTokko(status);
  if (disponibleEnTokko === false) {
    prop.disponibilidad = 'no disponible';
    avisos.push(`Tokko marca esta ficha como "${status}" → quedó "no disponible"`);
  }

  prop.disponibleDesde = extraerDisponibleDesde(texto, fechaDePublicacion(ficha));
  if (prop.disponibleDesde) {
    avisos.push(`disponibleDesde: ${prop.disponibleDesde} — deducido del texto, confirmá el año`);
  }

  // Positivo explícito o negativo explícito; si no dice nada, queda en false y
  // se pregunta.
  if (/servicios?\s+inclu|expensas\s+y\s+servicios|incluye\s+(?:luz|wifi)/i.test(texto)) {
    prop.serviciosIncluidos = true;
  } else if (/servicios?\s+a\s+cargo\s+del\s+inquilino/i.test(texto)) {
    prop.serviciosIncluidos = false;
  } else {
    avisos.push('serviciosIncluidos: la ficha no aclara si incluye luz + wifi (--servicios)');
  }

  if (!/mascota/i.test(texto)) {
    avisos.push('mascotas: la ficha no dice nada (--mascotas / --sin-mascotas)');
  }
  if (prop.minimoMeses === 1 && !/m[ií]nim/i.test(texto)) {
    avisos.push('minimoMeses: quedó en 1 porque la ficha no aclara el plazo (--minimo N)');
  }

  // `esPropio` no se deduce: una ficha publicada bajo la cuenta propia de Tokko
  // no necesariamente es una propiedad propia de BairesRental. Se avisa nomás.
  if (company && company.toLowerCase().includes(MI_INMOBILIARIA_TOKKO.toLowerCase())) {
    avisos.push(`la ficha está publicada bajo "${company}" — si es propiedad propia, pasá --propio`);
  } else if (company) {
    avisos.push(`OJO: la ficha aparece bajo otra inmobiliaria ("${company}")`);
  }

  if (!prop.imagen) avisos.push('la ficha no trae foto de portada (--imagen <url>, o subila con upload-fotos.js)');

  return { prop, avisos };
}

// ─── Mapeo de fichaprop.tech (Tencery) ───────────────────────────────────────

// El centro de CABA que fichaprop deja como coordenada cuando nadie movió el
// pin. Ver esPlaceholder() en resolve-map-coords.js: si se dibuja, la propiedad
// queda parada sobre el Obelisco.
const CENTRO_CABA = [-34.6037, -58.3816];
function esPlaceholder(lat, lng) {
  return Math.abs(lat - CENTRO_CABA[0]) < 1e-4 && Math.abs(lng - CENTRO_CABA[1]) < 1e-4;
}

// La fila de `properties` que devuelve fichaprop es el mismo objeto que
// add-from-tencery.js recibe como JSON, así que el mapeo pesado ya está hecho.
// Acá se agrega lo que la ficha trae y ese importador no mira: las fotos, los
// servicios declarados uno por uno y la inmobiliaria dueña de la publicación.
function fichapropToProperty(ficha) {
  const property = ficha.property;
  const avisos = [];

  const prop = tenceryToProperty(property);

  // La ficha es justamente el álbum de fotos para colegas, igual que en
  // ficha.info: va en `fotos`, no en `fichaUrl`.
  prop.fotos = ficha.url;

  const fotos = [...(property.property_images || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  prop.imagen = property.cover_image_url || fotos[0]?.image_url || '';

  const texto = `${prop.descripcion}\n${prop.titulo}`;

  // El importador de Tencery pide "amoblado" literal; las fichas suelen decir
  // "completamente equipado". Mismo criterio que el de ficha.info.
  if (/amoblad|amueblad|equipad/i.test(texto)) prop.amueblado = true;

  // `serviciosIncluidos` del catálogo es "incluye luz Y wifi". La ficha los
  // lista uno por uno, que es más confiable que el `full_package` de Tencery
  // ("todo incluido" puede ser expensas y nada más).
  const incluidos = (property.property_services || [])
    .filter(s => s.is_included)
    .map(s => (s.services?.name || '').toLowerCase());
  if (incluidos.length) {
    prop.serviciosIncluidos =
      incluidos.some(s => /luz|electricidad/.test(s)) &&
      incluidos.some(s => /internet|wifi/.test(s));
  } else {
    avisos.push('serviciosIncluidos: la ficha no lista servicios (--servicios / --sin-servicios)');
  }

  // Pines del mapa, salvo que la ficha traiga el placeholder del Obelisco: en
  // ese caso el link de Maps apunta a la dirección escrita, que es lo único
  // cierto, y el pin lo completa después resolve-map-coords.js.
  const lat = parseFloat(property.latitude);
  const lng = parseFloat(property.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !esPlaceholder(lat, lng)) {
    prop.lat = lat;
    prop.lng = lng;
    prop.direccionUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  } else {
    prop.direccionUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prop.direccion}, CABA, Argentina`)}`;
    avisos.push('la ficha no trae coordenadas propias — corré resolve-map-coords.js para el pin del mapa');
  }

  if (prop.disponibilidad !== 'disponible') {
    avisos.push(`la ficha está "${property.status}" en fichaprop → quedó "${prop.disponibilidad}"`);
  }
  if (prop.disponibleDesde) {
    avisos.push(`disponibleDesde: ${prop.disponibleDesde} — sale de la ficha, confirmalo`);
  }
  if (property.pet_friendly !== true && !/mascota/i.test(texto)) {
    avisos.push('mascotas: la ficha no dice nada (--mascotas / --sin-mascotas)');
  }
  if (prop.minimoMeses === 1 && !/m[ií]nim/i.test(texto)) {
    avisos.push('minimoMeses: quedó en 1 porque la ficha no aclara el plazo (--minimo N)');
  }

  const agencia = property.agencies?.name;
  if (agencia) {
    avisos.push(`la ficha está publicada bajo "${agencia}" — si igual es propiedad propia, pasá --propio`);
  }

  if (!prop.imagen) avisos.push('la ficha no trae foto de portada (--imagen <url>, o subila con upload-fotos.js)');

  return { prop, avisos };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function valorDe(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

// Qué avisos ya quedaron respondidos por un flag: el aviso arranca con el
// nombre del campo, así que alcanza con mirar el prefijo. Sin esto el resumen
// sigue pidiendo el plazo mínimo aunque lo hayas pasado con --minimo.
function avisosPendientes(avisos, args) {
  const respondidos = [];
  if (args.includes('--mascotas') || args.includes('--sin-mascotas')) respondidos.push('mascotas:');
  if (args.includes('--servicios') || args.includes('--sin-servicios')) respondidos.push('serviciosIncluidos:');
  if (args.includes('--propio')) respondidos.push('la ficha está publicada bajo');
  if (valorDe(args, '--minimo') !== null) respondidos.push('minimoMeses:');
  if (valorDe(args, '--desde')) respondidos.push('disponibleDesde:');
  if (valorDe(args, '--imagen')) respondidos.push('imagen:', 'la ficha no trae foto');
  return avisos.filter(a => !respondidos.some(r => a.startsWith(r)));
}

function aplicarOverrides(prop, args) {
  const id = valorDe(args, '--id');
  if (id) prop.id = id.trim();

  const precio = valorDe(args, '--precio');
  if (precio !== null) prop.precio = parseFloat(precio);

  const minimo = valorDe(args, '--minimo');
  if (minimo !== null) prop.minimoMeses = parseInt(minimo, 10);

  const barrio = valorDe(args, '--barrio');
  if (barrio) prop.barrio = barrio;

  const titulo = valorDe(args, '--titulo');
  if (titulo) prop.titulo = titulo;

  const imagen = valorDe(args, '--imagen');
  if (imagen) prop.imagen = imagen;

  const desde = valorDe(args, '--desde');
  if (desde) prop.disponibleDesde = desde;

  if (args.includes('--mascotas')) prop.mascotas = true;
  if (args.includes('--sin-mascotas')) prop.mascotas = false;
  if (args.includes('--servicios')) prop.serviciosIncluidos = true;
  if (args.includes('--sin-servicios')) prop.serviciosIncluidos = false;
  if (args.includes('--propio')) prop.esPropio = true;

  return prop;
}

function mostrar(prop, avisos, fuente) {
  console.log(`\n=== Propiedad mapeada desde ${fuente} ===`);
  console.log(JSON.stringify(prop, null, 2));

  if (avisos.length) {
    console.log('\n⚠️  Revisá antes de confirmar:');
    avisos.forEach(a => console.log('  -', a));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('-'));
  const yes = args.includes('--yes') || args.includes('-y');
  const dryRun = args.includes('--dry-run');
  const forceUpdate = args.includes('--update');
  const outFile = valorDe(args, '--out');

  if (!url) {
    console.error('Uso: node scripts/add-from-ficha.js <url de la ficha> [--id alq-07] [--dry-run] [--out mapped.json] [--yes]');
    process.exit(1);
  }

  // Cada ficha se lee distinto y tiene su propia serie de ids, pero de acá para
  // abajo el flujo es el mismo.
  const fuente = esUrlDeFicha(url)
    ? { nombre: 'ficha.info', serie: 'alq', canonica: urlCanonica(url), leer: async () => fichaToProperty(await fetchFicha(url)) }
    : esUrlDeFichaprop(url)
      ? { nombre: 'fichaprop.tech', serie: 'tenc', canonica: urlCanonicaFichaprop(url), leer: async () => fichapropToProperty(await fetchFichaprop(url)) }
      : null;

  if (!fuente) {
    console.error(`❌ "${url}" no es una URL de ficha conocida.`);
    console.error('   Se esperan https://ficha.info/p/HASH o https://www.fichaprop.tech/ficha/UUID.');
    process.exit(1);
  }

  console.log(`Leyendo ${fuente.canonica} …`);
  const { prop, avisos } = await fuente.leer();

  // De qué link salió, para poder volver a leerlo y refrescar la propiedad más
  // adelante. No alcanza con `fotos`: guarda la misma URL sólo en alquileres, y
  // es un campo editable que puede terminar apuntando a un álbum de Google
  // Photos. En venta ni siquiera existe — ahí `fotos` son las fotos.
  prop.origen = {
    fuente: fuente.nombre,
    url: fuente.canonica,
    leidoEn: new Date().toISOString(),
  };

  const catalogo = await leerCatalogo('alquileres');

  // El id sale del catálogo y de la serie de la ficha, salvo que lo pisen
  // con --id.
  prop.id = proximoId(catalogo, fuente.serie);
  aplicarOverrides(prop, args);

  mostrar(prop, avisosPendientes(avisos, args), fuente.nombre);

  const errores = validate(prop);
  if (errores.length) {
    console.error('\n❌ Errores de validación:');
    errores.forEach(e => console.error('  -', e));
    process.exit(1);
  }

  const duplicados = findDuplicates(catalogo, prop);
  if (duplicados.length) {
    console.log('\n⚠️  Posibles duplicados detectados:');
    duplicados.forEach(d => console.log('  -', d));
  }

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(prop, null, 2), 'utf8');
    console.log(`\nMapeado guardado en: ${outFile}`);
    console.log('Editá lo que haga falta y después:');
    console.log(`  node scripts/add-property.js ${outFile}`);
    return;
  }

  if (dryRun) {
    console.log('\n[dry-run] No se guardaron cambios.');
    return;
  }

  const existente = catalogo.find(p => p.id === prop.id);

  // Mismo criterio que los otros importadores: --yes es "no me preguntes lo de
  // rutina", no "pisá lo que haya". Reemplazar se pide con --update.
  if (existente && !forceUpdate) {
    if (yes) {
      console.error(`\n❌ El ID "${prop.id}" ya existe: "${existente.titulo}".`);
      console.error('   Cambiá el id con --id, o pasá --update si la idea es reemplazar esa propiedad.');
      process.exit(1);
    }
    const r = await prompt(`\n⚠️  ID "${prop.id}" ya existe ("${existente.titulo}"). ¿Sobreescribir? (s/N): `);
    if (!/^s/i.test(r)) { console.log('Cancelado.'); return; }
  } else if (!existente && !yes) {
    const r = await prompt('\n¿Agregar al catálogo? (S/n): ');
    if (/^n/i.test(r)) { console.log('Cancelado.'); return; }
  }

  // La portada viene del CDN de la otra inmobiliaria y se cae el día que dan de
  // baja la publicación. Se copia a nuestro Storage, que es lo mismo que hace el
  // panel con `importListingImage`. Si falla, la propiedad se carga igual con la
  // URL de ellos: perder la foto no puede costar la carga entera.
  if (prop.imagen && !esNuestra(prop.imagen)) {
    process.stdout.write('\nCopiando la portada a nuestro Storage… ');
    try {
      prop.imagen = await importarDesdeUrl('alquileres', prop.id, 'cover', prop.imagen);
      console.log('ok');
    } catch (e) {
      console.log(`no se pudo (${e.message})`);
      console.log('   Queda apuntando al CDN de ellos. Se puede reintentar con migrar-imagenes.js.');
    }
  }

  await guardarPropiedad('alquileres', prop);
  console.log(`\n✅ ${existente ? 'Actualizado' : 'Agregado'}: "${prop.titulo}" (ID: ${prop.id})`);
  console.log('   Guardado en Firestore (rentals) — ya está publicado en el sitio.');
}

if (require.main === module) {
  main().catch(err => { console.error('Error:', err.message); process.exit(1); });
}

module.exports = { fichaToProperty, fichapropToProperty, proximoId, extraerDisponibleDesde };
