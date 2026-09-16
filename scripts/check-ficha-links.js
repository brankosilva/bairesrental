#!/usr/bin/env node
// Revisa las fichas de Tokko (ficha.info) enlazadas en el catálogo y detecta
// si Tokko las marca como no disponibles o si pasaron a otra inmobiliaria.
// Es de solo lectura: genera un reporte para revisión manual, no toca el catálogo.
//
// Leía data/departamentos.json, que alimentaba el sitio estático. Ese sitio se
// dio de baja y el archivo se había quedado atrás (le faltaban propiedades que
// solo existían en Firestore), así que la auditoría tenía un punto ciego.
// Ahora lee la colección `rentals` de Firestore, que es el catálogo real.
//
// Uso:
//   node scripts/check-ficha-links.js
//   node scripts/check-ficha-links.js --json reporte.json   (además guarda resultado en JSON)

const fs = require('fs');

const { leerCatalogo } = require('./lib/catalogo');
const { fetchFicha, estadoDeFicha, esDisponibleSegunTokko, MI_INMOBILIARIA_TOKKO } = require('./lib/ficha');

const DELAY_MS = 400; // pausa entre requests para no saturar ficha.info

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function revisarFicha(url, disponibilidadLocal) {
  try {
    // El parseo del HTML de ficha.info vive en lib/ficha.js — reconstruye el
    // payload de Next.js y devuelve el JSON de Tokko entero. Antes eran regex
    // sobre las comillas escapadas del HTML crudo.
    const ficha = await fetchFicha(url);
    const { status, company, branch, active } = estadoDeFicha(ficha);

    if (!status && !company) {
      return { ok: false, motivo: 'No se pudo leer el contenido de la ficha (formato cambiado o vacía)' };
    }

    const problemas = [];
    const tokkoDisponible = esDisponibleSegunTokko(status);
    const localDisponible = disponibilidadLocal === 'disponible';

    if (tokkoDisponible !== null && tokkoDisponible !== localDisponible) {
      problemas.push(`estado desactualizado: local="${disponibilidadLocal}" pero Tokko dice "${status}"`);
    } else if (tokkoDisponible === false && status && !/^no disponible$/i.test(status.trim())) {
      // Ej: "Tasación" — ya coincide con el estado local (no disponible),
      // pero vale la pena avisar porque puede indicar que salió del rubro alquiler.
      problemas.push(`Tokko muestra un estado distinto a disponible/no disponible: "${status}" (coincide con local, revisar igual)`);
    }

    if (active === false) problemas.push('ficha marcada inactiva en Tokko');
    if (MI_INMOBILIARIA_TOKKO && company && !company.toLowerCase().includes(MI_INMOBILIARIA_TOKKO.toLowerCase())) {
      problemas.push(`aparece otra inmobiliaria: "${company}"${branch ? ' / ' + branch : ''}`);
    }

    return { ok: true, status, company, branch, problemas };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

  const catalogo = await leerCatalogo('alquileres');
  const conFicha = catalogo.filter(p => /ficha\.info/i.test(p.fotos || '') || /ficha\.info/i.test(p.fichaUrl || ''));

  if (conFicha.length === 0) {
    console.log('No hay propiedades con links de ficha.info en el catálogo.');
    return;
  }

  console.log(`Revisando ${conFicha.length} ficha(s) de Tokko...\n`);

  const resultados = [];

  for (const p of conFicha) {
    const url = (p.fichaUrl && /ficha\.info/i.test(p.fichaUrl)) ? p.fichaUrl : p.fotos;
    const r = await revisarFicha(url, p.disponibilidad);

    const item = { id: p.id, titulo: p.titulo, barrio: p.barrio, url, ...r };
    resultados.push(item);

    if (!r.ok) {
      console.log(`⚠️  ${p.id} — "${p.titulo}"`);
      console.log(`    ${url}`);
      console.log(`    No se pudo verificar: ${r.motivo}\n`);
    } else if (r.problemas.length > 0) {
      console.log(`🚩 ${p.id} — "${p.titulo}" (${p.barrio})`);
      console.log(`    ${url}`);
      r.problemas.forEach(m => console.log(`    - ${m}`));
      console.log(`    Estado local actual: ${p.disponibilidad}\n`);
    } else {
      console.log(`✅ ${p.id} — OK (Tokko: ${r.status || 'disponible'}${r.company ? ', ' + r.company : ''})`);
    }

    await sleep(DELAY_MS);
  }

  const aRevisar = resultados.filter(r => !r.ok || (r.problemas && r.problemas.length > 0));

  console.log('\n=== Resumen ===');
  console.log(`Total revisadas: ${resultados.length}`);
  console.log(`A revisar:       ${aRevisar.length}`);

  if (aRevisar.length > 0) {
    console.log('\nIDs a revisar: ' + aRevisar.map(r => r.id).join(', '));
  }

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ generadoEn: new Date().toISOString(), resultados, aRevisar }, null, 2), 'utf8');
    console.log(`\nReporte guardado en ${jsonOut}`);
  }

  if (aRevisar.length > 0) process.exitCode = 1;
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
