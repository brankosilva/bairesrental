#!/usr/bin/env node
// Revisa los links del catálogo de alquileres y arma un reporte para revisión
// manual. Es de solo lectura: no toca el catálogo. Tres pasadas:
//
//   1. Fichas de Tokko (ficha.info) — se lee la ficha entera, así que se puede
//      detectar que Tokko la marcó no disponible o que pasó a otra agencia.
//   2. Fichas de Tencery (fichaprop.tech) — lo mismo contra su API: si la
//      propiedad ya no es pública o figura alquilada.
//   3. Todo el resto de los links (álbumes, avisos de otros portales y la
//      portada de cada propiedad) — de esos no se puede leer un estado, sólo
//      si siguen en pie. Ver lib/enlaces.js: un status 200 no alcanza.
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
const { fetchFicha, estadoDeFicha, esDisponibleSegunTokko, esUrlDeFicha, MI_INMOBILIARIA_TOKKO } = require('./lib/ficha');
const { esUrlDeFichaprop, fetchFichaprop } = require('./lib/fichaprop');
const { estadoDeEnlace } = require('./lib/enlaces');

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

// Las fichas de Tencery no tienen HTML que parsear, pero a su API se le puede
// preguntar lo mismo que a Tokko: si la propiedad sigue publicada y si ya se
// alquiló.
async function revisarFichaprop(url, disponibilidadLocal) {
  try {
    const { property } = await fetchFichaprop(url);
    const problemas = [];
    const enFichaprop = property.rented_at ? 'alquilada' : property.status;
    if ((property.rented_at || property.status !== 'published') && disponibilidadLocal === 'disponible') {
      problemas.push(`estado desactualizado: local="${disponibilidadLocal}" pero fichaprop dice "${enFichaprop}"`);
    }
    return { ok: true, status: enFichaprop, company: property.agencies?.name || null, problemas };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

// Los links que no son fichas. `imagen` va siempre: si la portada muere, el
// card queda con el placeholder 📸, que es lo más visible de todo.
const ETIQUETA_CAMPO = { fotos: 'el link de fotos', fichaUrl: 'el link de la publicación', imagen: 'la portada' };

function enlacesSueltosDe(p) {
  const links = [];
  const fotos = typeof p.fotos === 'string' ? p.fotos.trim() : '';
  if (fotos && !esUrlDeFicha(fotos) && !esUrlDeFichaprop(fotos)) links.push({ campo: 'fotos', url: fotos });
  const ficha = (p.fichaUrl || '').trim();
  if (ficha && !esUrlDeFicha(ficha) && !esUrlDeFichaprop(ficha)) links.push({ campo: 'fichaUrl', url: ficha });
  const imagen = (p.imagen || '').trim();
  if (imagen) links.push({ campo: 'imagen', url: imagen });
  return links;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

  const catalogo = await leerCatalogo('alquileres');
  const resultados = [];

  // ── 1. Fichas de Tokko ─────────────────────────────────────────────────────
  const conFicha = catalogo.filter(p => /ficha\.info/i.test(p.fotos || '') || /ficha\.info/i.test(p.fichaUrl || ''));
  console.log(`Revisando ${conFicha.length} ficha(s) de Tokko...\n`);

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

  // ── 2. Fichas de Tencery ───────────────────────────────────────────────────
  const conFichaprop = catalogo.filter(p => esUrlDeFichaprop(p.fotos || '') || esUrlDeFichaprop(p.fichaUrl || ''));
  if (conFichaprop.length) {
    console.log(`\nRevisando ${conFichaprop.length} ficha(s) de Tencery...\n`);
  }

  for (const p of conFichaprop) {
    const url = esUrlDeFichaprop(p.fichaUrl || '') ? p.fichaUrl : p.fotos;
    const r = await revisarFichaprop(url, p.disponibilidad);
    resultados.push({ id: p.id, titulo: p.titulo, barrio: p.barrio, url, ...r });

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
      console.log(`✅ ${p.id} — OK (fichaprop: ${r.status}${r.company ? ', ' + r.company : ''})`);
    }

    await sleep(DELAY_MS);
  }

  // ── 3. El resto de los links ───────────────────────────────────────────────
  // Un problema por propiedad, no uno por link: si a la misma se le cayeron la
  // portada y el álbum, en el Issue tiene que aparecer una sola vez.
  const conEnlaces = catalogo.map(p => ({ p, links: enlacesSueltosDe(p) })).filter(x => x.links.length);
  const totalLinks = conEnlaces.reduce((n, x) => n + x.links.length, 0);
  console.log(`\nRevisando ${totalLinks} link(s) sueltos (álbumes, avisos y portadas)...\n`);

  let rotos = 0;
  for (const { p, links } of conEnlaces) {
    const problemas = [];
    for (const { campo, url } of links) {
      const { estado, motivo } = await estadoDeEnlace(url);
      if (estado === 'roto' || estado === 'sospechoso') {
        problemas.push(`${ETIQUETA_CAMPO[campo]} ${estado === 'roto' ? 'está caído' : 'quedó raro'}: ${motivo} — ${url}`);
      }
      await sleep(DELAY_MS);
    }

    if (problemas.length) {
      rotos++;
      console.log(`🔗 ${p.id} — "${p.titulo}" (${p.barrio})`);
      problemas.forEach(m => console.log(`    - ${m}`));
      console.log('');
      const yaEstaba = resultados.find(r => r.id === p.id && r.ok);
      if (yaEstaba) yaEstaba.problemas.push(...problemas);
      else resultados.push({ id: p.id, titulo: p.titulo, barrio: p.barrio, url: links[0].url, ok: true, problemas });
    }
  }
  if (!rotos) console.log('✅ Todos los links sueltos responden.');

  const aRevisar = resultados.filter(r => !r.ok || (r.problemas && r.problemas.length > 0));

  console.log('\n=== Resumen ===');
  console.log(`Fichas revisadas: ${conFicha.length + conFichaprop.length}`);
  console.log(`Links revisados:  ${totalLinks}`);
  console.log(`A revisar:        ${aRevisar.length}`);

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
