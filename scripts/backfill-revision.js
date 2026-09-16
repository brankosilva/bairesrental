#!/usr/bin/env node
// Marca como aprobadas las propiedades que ya estaban en el catálogo antes de
// que existiera el flujo de revisión.
//
// POR QUÉ ES OBLIGATORIO Y NO UNA PROLIJIDAD
// ------------------------------------------
// Desde que los vendedores cargan con aprobación previa, las páginas públicas
// consultan Firestore con `where('revision','==','aprobada')`, y firestore.rules
// sólo le deja leer a un anónimo los documentos que tienen ese valor.
//
// Un `where` de igualdad NO matchea documentos a los que les falta el campo. O
// sea que cualquier propiedad sin `revision` se cae del catálogo, de la home y
// del sitemap: no da error, simplemente no aparece. Las ~88 que cargó el admin
// por script no lo tienen.
//
// Por eso este script corre PRIMERO, antes de desplegar la app y mucho antes de
// desplegar las reglas nuevas.
//
// Es idempotente: sólo toca documentos a los que les falta el campo, así que se
// puede correr las veces que haga falta. Nunca pisa una 'pendiente' ni una
// 'rechazada'.
//
// Uso:
//   node scripts/backfill-revision.js            # sólo mira y cuenta
//   node scripts/backfill-revision.js --apply    # escribe

const { leerCatalogo, actualizarCampos } = require('./lib/catalogo');

const APPLY = process.argv.includes('--apply');
const CATALOGOS = ['alquileres', 'ventas'];

async function main() {
  let totalSinCampo = 0;

  for (const cual of CATALOGOS) {
    const props = await leerCatalogo(cual);
    const sinCampo = props.filter((p) => p.revision === undefined);
    const porEstado = props.reduce((acc, p) => {
      const k = p.revision === undefined ? '(sin campo)' : p.revision;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n${cual}: ${props.length} propiedades`);
    for (const [estado, n] of Object.entries(porEstado).sort()) {
      console.log(`  ${String(n).padStart(4)}  ${estado}`);
    }

    totalSinCampo += sinCampo.length;
    if (!sinCampo.length) {
      console.log('  → nada que hacer.');
      continue;
    }

    if (!APPLY) {
      console.log(`  → ${sinCampo.length} quedarían en 'aprobada'.`);
      // Las primeras, para poder mirar a ojo que no haya nada raro antes de
      // escribir sobre el catálogo de producción.
      for (const p of sinCampo.slice(0, 10)) {
        console.log(`      ${p.id}${p.sellerUid ? `  (sellerUid ${p.sellerUid.slice(0, 8)}…)` : ''}`);
      }
      if (sinCampo.length > 10) console.log(`      … y ${sinCampo.length - 10} más`);
      continue;
    }

    // actualizarCampos() usa batch.update(), que toca SÓLO el campo que se le
    // pasa. Nada de guardarPropiedad() acá: eso manda el documento entero.
    const n = await actualizarCampos(
      cual,
      sinCampo.map((p) => ({ id: p.id, campos: { revision: 'aprobada' } })),
    );
    console.log(`  → ${n} marcadas como 'aprobada'.`);
  }

  if (!APPLY && totalSinCampo) {
    console.log(`\n${totalSinCampo} propiedades sin el campo. Volvé a correr con --apply para escribirlas.`);
  } else if (APPLY) {
    console.log('\nListo. Ahora sí se puede desplegar la app y después las reglas.');
  } else {
    console.log('\nTodo el catálogo tiene el campo. No hace falta el backfill.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
