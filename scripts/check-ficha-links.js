#!/usr/bin/env node
// Revisa las fichas de Tokko (ficha.info) enlazadas en el catálogo y detecta
// si Tokko las marca como no disponibles o si pasaron a otra inmobiliaria.
// No modifica data/departamentos.json — solo genera un reporte para revisión manual.
//
// Uso:
//   node scripts/check-ficha-links.js
//   node scripts/check-ficha-links.js --json reporte.json   (además guarda resultado en JSON)

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'data', 'departamentos.json');
const DELAY_MS = 400; // pausa entre requests para no saturar ficha.info

// Nombre de la inmobiliaria/cuenta Tokko bajo la que se publican las fichas.
// Si una ficha muestra una "company" distinta, se marca como sospechosa
// (indicaría que la propiedad pasó a otra cuenta/agencia dentro de Tokko).
const MI_INMOBILIARIA_TOKKO = 'GO NEGOCIOS INMOBILIARIOS';

function extraer(html, campo, prevCampo) {
  // El HTML de ficha.info trae el JSON de Tokko embebido con comillas escapadas
  // (self.__next_f.push([1,"...\"status\":{\"id\":4,\"name\":\"No disponible\"}..."]))
  const patrones = {
    status: /\\"status\\":\{\\"id\\":\d+,\\"name\\":\\"([^"\\]+)\\"/,
    company: /\\"company\\":\{\\"id\\":\d+,\\"name\\":\\"([^"\\]+)\\"/,
    branch: /\\"branch\\":\{\\"phone\\":\\"[^"\\]*\\",\\"name\\":\\"([^"\\]+)\\"/,
    active: /\\"active\\":(true|false)/
  };
  const m = html.match(patrones[campo]);
  return m ? m[1] : null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function revisarFicha(url) {
  try {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) {
      return { ok: false, motivo: `HTTP ${resp.status}` };
    }
    const html = await resp.text();
    const status = extraer(html, 'status');
    const company = extraer(html, 'company');
    const branch = extraer(html, 'branch');
    const active = extraer(html, 'active');

    if (!status && !company) {
      return { ok: false, motivo: 'No se pudo leer el contenido de la ficha (formato cambiado o vacía)' };
    }

    const problemas = [];
    if (status && !/disponible/i.test(status)) problemas.push(`Tokko dice "${status}"`);
    if (active === 'false') problemas.push('ficha marcada inactiva en Tokko');
    if (MI_INMOBILIARIA_TOKKO && company && !company.toLowerCase().includes(MI_INMOBILIARIA_TOKKO.toLowerCase())) {
      problemas.push(`aparece otra inmobiliaria: "${company}"${branch ? ' / ' + branch : ''}`);
    }

    return { ok: true, status, company, branch, problemas };
  } catch (e) {
    return { ok: false, motivo: `Error de red: ${e.message}` };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

  const catalogo = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const conFicha = catalogo.filter(p => /ficha\.info/i.test(p.fotos || '') || /ficha\.info/i.test(p.fichaUrl || ''));

  if (conFicha.length === 0) {
    console.log('No hay propiedades con links de ficha.info en el catálogo.');
    return;
  }

  console.log(`Revisando ${conFicha.length} ficha(s) de Tokko...\n`);

  const resultados = [];

  for (const p of conFicha) {
    const url = (p.fichaUrl && /ficha\.info/i.test(p.fichaUrl)) ? p.fichaUrl : p.fotos;
    const r = await revisarFicha(url);

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
