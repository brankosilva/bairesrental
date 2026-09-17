#!/usr/bin/env node
// Completa `origen` en las propiedades que ya estaban cargadas antes de que el
// campo existiera.
//
// `origen` es el link de la ficha del que salió la propiedad
// (`{ fuente, url }`), y es lo que va a permitir releerla para refrescar precio
// y disponibilidad. Desde ahora lo sellan los dos importadores —el script y el
// callable del panel— al cargar; para lo que ya estaba hay que deducirlo.
//
// DE DÓNDE SALE. No hay adivinanza ni red: se mira lo que la propiedad ya tiene
// guardado y se acepta sólo si es una URL de ficha reconocible.
//
//   - alquileres: `fotos` es el link de la ficha para colegas (así lo escriben
//     add-from-ficha.js y el panel), y a veces quedó en `fichaUrl`.
//   - ventas: `fotos` son las fotos de la galería, así que lo único que puede
//     traer el link es `fichaUrl`. La mayoría no va a tener nada que deducir:
//     el link para colegas de una venta no se guardaba en ningún lado.
//
// Un álbum de Google Photos, un aviso de Zonaprop o un link de Airbnb NO son
// fichas: no se pueden releer, así que esas propiedades quedan sin `origen` y
// se listan al final.
//
// `leidoEn` queda sin escribir a propósito: dice cuándo se leyó la ficha por
// última vez, y acá no se leyó ninguna — sólo se dedujo el link.
//
// Es idempotente: no toca las que ya tienen `origen`.
//
// Uso:
//   node scripts/backfill-origen.js            # sólo mira y cuenta
//   node scripts/backfill-origen.js --apply    # escribe

const { leerCatalogo, actualizarCampos } = require('./lib/catalogo');
const { esUrlDeFicha, urlCanonica } = require('./lib/ficha');
const { esUrlDeFichaprop, urlCanonica: urlCanonicaFichaprop } = require('./lib/fichaprop');

const APPLY = process.argv.includes('--apply');
const CATALOGOS = ['alquileres', 'ventas'];

// Devuelve { fuente, url } si el texto es el link de una ficha que sabemos leer.
function origenDe(texto) {
  const url = (texto || '').trim();
  if (esUrlDeFicha(url)) return { fuente: 'ficha.info', url: urlCanonica(url) };
  if (esUrlDeFichaprop(url)) return { fuente: 'fichaprop.tech', url: urlCanonicaFichaprop(url) };
  return null;
}

// Los campos donde puede haber quedado el link, en orden de confianza. `fotos`
// de una venta es un array de fotos: ahí no hay nada que buscar.
function candidatos(prop) {
  return [typeof prop.fotos === 'string' ? prop.fotos : '', prop.fichaUrl];
}

async function main() {
  let totalCompletadas = 0;
  const sinOrigen = [];

  for (const cual of CATALOGOS) {
    const props = await leerCatalogo(cual);
    const pendientes = props.filter((p) => !p.origen);
    const cambios = [];

    for (const p of pendientes) {
      const origen = candidatos(p).map(origenDe).find(Boolean);
      if (origen) cambios.push({ id: p.id, campos: { origen } });
      else sinOrigen.push({ cual, id: p.id, titulo: p.titulo, fotos: p.fotos, fichaUrl: p.fichaUrl });
    }

    const porFuente = cambios.reduce((acc, c) => {
      acc[c.campos.origen.fuente] = (acc[c.campos.origen.fuente] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n=== ${cual} ===`);
    console.log(`  total:            ${props.length}`);
    console.log(`  ya tenían origen: ${props.length - pendientes.length}`);
    console.log(`  se completan:     ${cambios.length}${cambios.length ? `  (${Object.entries(porFuente).map(([f, n]) => `${f}: ${n}`).join(', ')})` : ''}`);
    console.log(`  sin link:         ${pendientes.length - cambios.length}`);

    for (const c of cambios.slice(0, 5)) {
      console.log(`    ${c.id} → ${c.campos.origen.url}`);
    }
    if (cambios.length > 5) console.log(`    … y ${cambios.length - 5} más`);

    if (APPLY && cambios.length) {
      await actualizarCampos(cual, cambios);
      console.log(`  ✅ escritas ${cambios.length}`);
    }
    totalCompletadas += cambios.length;
  }

  if (sinOrigen.length) {
    console.log(`\n=== Sin origen deducible (${sinOrigen.length}) ===`);
    console.log('Son las que no entraron por una ficha, o cuyo link ya no está guardado.');
    console.log('Se completan pegando el link a mano, o volviendo a importarlas.\n');
    for (const p of sinOrigen) {
      const pista = typeof p.fotos === 'string' && p.fotos ? p.fotos : p.fichaUrl || '—';
      console.log(`  [${p.cual}] ${p.id}: ${p.titulo}`);
      console.log(`      fotos/fichaUrl: ${pista}`);
    }
  }

  console.log(
    APPLY
      ? `\n✅ Listo: ${totalCompletadas} propiedades con origen nuevo.`
      : `\n[dry-run] Se completarían ${totalCompletadas}. Correlo con --apply para escribir.`,
  );
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
