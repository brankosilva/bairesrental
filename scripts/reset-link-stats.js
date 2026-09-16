#!/usr/bin/env node
// Pone en cero la actividad de los links de vendedores.
//
// POR QUÉ HACE FALTA
// ------------------
// Hasta N11, `opens` sumaba una por cada request a /l/*: recargar, volver
// atrás o mirar tres fichas del catálogo eran aperturas distintas de la
// misma persona. Los números que quedaron en Firestore no miden interés,
// miden navegación, y no son comparables con los que empiezan a contarse
// ahora (una por persona cada media hora). Mezclados en la misma columna
// mienten peor que un cero.
//
// QUÉ LIMPIA Y QUÉ NO
// -------------------
// Limpia: opens, botOpens, whatsappClicks, visitors, firstOpenAt, lastOpenAt
// y los eventos de links/{code}/opens.
//
// NO toca: leads ni clicks (personas que dejaron sus datos — eso es un
// contacto real, no una métrica de navegación), ni el nombre del link, ni
// la nota, ni el resultado que marcó el vendedor, ni si está activo.
//
// Los campos se sacan en vez de ponerse en 0: el panel lee con n() —un campo
// que falta vale 0— y así un link sin abrir se ve igual que uno recién
// creado ("sin abrir") en vez de "0 aperturas".
//
// Es irreversible: los eventos que saca no están en ningún otro lado.
//
// Uso:
//   node scripts/reset-link-stats.js                    # sólo mira y cuenta
//   node scripts/reset-link-stats.js --apply            # escribe
//   node scripts/reset-link-stats.js --solo-contadores  # deja los eventos
//   node scripts/reset-link-stats.js --code juan-perez  # un solo link

const { getDb } = require('./lib/firestore');

const APPLY = process.argv.includes('--apply');
const SOLO_CONTADORES = process.argv.includes('--solo-contadores');
const codeArg = process.argv.indexOf('--code');
const CODE = codeArg !== -1 ? process.argv[codeArg + 1] : null;

const CAMPOS = ['opens', 'botOpens', 'whatsappClicks', 'visitors', 'firstOpenAt', 'lastOpenAt'];

// Los eventos se sacan de a tandas: un link muy usado puede tener miles y un
// batch de Firestore aguanta 500 escrituras.
async function limpiarEventos(ref) {
  let total = 0;
  for (;;) {
    const snap = await ref.limit(400).get();
    if (snap.empty) return total;
    const batch = ref.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

async function main() {
  const db = getDb();
  const links = CODE
    ? [await db.collection('links').doc(CODE).get()]
    : (await db.collection('links').get()).docs;

  if (CODE && !links[0].exists) {
    console.error(`No existe el link "${CODE}".`);
    process.exit(1);
  }

  const n = (v) => (typeof v === 'number' ? v : 0);
  let totOpens = 0, totBots = 0, totWa = 0, totEventos = 0, conDatos = 0;

  console.log(`${links.length} link${links.length === 1 ? '' : 's'}\n`);
  console.log('  aperturas   bots  contactos  eventos  leads  link');

  for (const doc of links) {
    const d = doc.data();
    const eventos = SOLO_CONTADORES
      ? 0
      : (await doc.ref.collection('opens').count().get()).data().count;
    const tiene = CAMPOS.some((c) => d[c] !== undefined) || eventos > 0;
    if (!tiene) continue;

    conDatos += 1;
    totOpens += n(d.opens);
    totBots += n(d.botOpens);
    totWa += n(d.whatsappClicks);
    totEventos += eventos;
    const leads = Math.max(n(d.leads), n(d.clicks));
    console.log(
      `  ${String(n(d.opens)).padStart(9)}  ${String(n(d.botOpens)).padStart(5)}  ` +
      `${String(n(d.whatsappClicks)).padStart(9)}  ${String(eventos).padStart(7)}  ` +
      `${String(leads).padStart(5)}  ${doc.id}`,
    );

    if (!APPLY) continue;

    const vacio = require('firebase-admin').firestore.FieldValue.delete();
    await doc.ref.update(Object.fromEntries(CAMPOS.map((c) => [c, vacio])));
    if (!SOLO_CONTADORES) await limpiarEventos(doc.ref.collection('opens'));
  }

  console.log(
    `\n  ${totOpens} aperturas, ${totBots} de bots, ${totWa} contactos y ` +
    `${totEventos} eventos en ${conDatos} link${conDatos === 1 ? '' : 's'}.`,
  );
  console.log('  Los leads NO se tocan.');
  console.log(
    APPLY
      ? '\n  Listo.'
      : `\n  Nada escrito todavía. Para escribir: node scripts/reset-link-stats.js --apply${
          SOLO_CONTADORES ? ' --solo-contadores' : ''
        }${CODE ? ` --code ${CODE}` : ''}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
