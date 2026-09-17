#!/usr/bin/env node
// Copia a nuestro Storage las fotos del catálogo que todavía cuelgan del CDN de
// otro (Tokko, el storage de fichaprop, Airbnb, lo que sea).
//
// POR QUÉ. Una URL ajena vive mientras la otra inmobiliaria mantenga publicada
// la propiedad. El día que la dan de baja, la foto del catálogo pasa a ser un
// 404 y el card queda con el placeholder 📸 — sin que nada avise. Las fotos de
// una publicación nuestra tienen que estar en Storage, que es lo que ya hacen
// el panel (`importListingImage`) y, desde ahora, `add-from-ficha.js`.
//
// QUÉ TOCA. Sólo las fotos que no son nuestras:
//   - alquileres: el campo `imagen` (la portada) → rentals/<id>/cover.<ext>
//   - ventas:     los elementos de `fotos` (la galería) → sales/<id>/foto-N.<ext>
// El orden de la galería se respeta, y las que ya estaban en Storage se dejan
// tal cual: bajarlas y volver a subirlas no arregla nada.
//
// Es idempotente: una vez migrada, la URL ya es nuestra y la propiedad se
// saltea. Si una foto falla (404, no es una imagen, pesa de más) se informa y
// se sigue con la siguiente; la propiedad se guarda con lo que sí se pudo
// copiar.
//
// Uso:
//   node scripts/migrar-imagenes.js                      # sólo mira y cuenta
//   node scripts/migrar-imagenes.js --apply              # copia y escribe
//   node scripts/migrar-imagenes.js --apply --solo=ventas
//   node scripts/migrar-imagenes.js --apply --limite 10  # de a tandas

const { leerCatalogo, actualizarCampos } = require('./lib/catalogo');
const { esNuestra, importarDesdeUrl } = require('./lib/storage');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const soloArg = args.find((a) => a.startsWith('--solo='));
const SOLO = soloArg ? soloArg.split('=')[1] : null;
const limIdx = args.indexOf('--limite');
const LIMITE = limIdx >= 0 ? parseInt(args[limIdx + 1], 10) : Infinity;

const CATALOGOS = ['alquileres', 'ventas'];

// Qué fotos tiene la propiedad y bajo qué campo van a volver: los alquileres
// tienen una portada en `imagen`, las ventas una galería en `fotos`.
function fotosDe(cual, p) {
  if (cual === 'alquileres') {
    return { campo: 'imagen', urls: p.imagen ? [p.imagen] : [] };
  }
  return { campo: 'fotos', urls: Array.isArray(p.fotos) ? p.fotos : [] };
}

function nombreDe(cual, i) {
  return cual === 'alquileres' ? 'cover' : `foto-${i + 1}`;
}

async function main() {
  let totalFotos = 0;
  let migradas = 0;
  let fallidas = 0;

  for (const cual of CATALOGOS) {
    if (SOLO && SOLO !== cual) continue;

    const props = await leerCatalogo(cual);
    const pendientes = props
      .map((p) => ({ p, ...fotosDe(cual, p) }))
      .filter((x) => x.urls.some((u) => u && !esNuestra(u)))
      .slice(0, LIMITE);

    const cuantas = pendientes.reduce((n, x) => n + x.urls.filter((u) => u && !esNuestra(u)).length, 0);
    console.log(`\n=== ${cual} ===`);
    console.log(`  propiedades con fotos ajenas: ${pendientes.length} de ${props.length}`);
    console.log(`  fotos a copiar:               ${cuantas}`);
    totalFotos += cuantas;

    for (const { p, campo, urls } of pendientes) {
      const ajenas = urls.filter((u) => u && !esNuestra(u)).length;
      console.log(`\n  ${p.id} — ${p.titulo} (${ajenas} foto${ajenas === 1 ? '' : 's'})`);

      if (!APPLY) {
        urls.filter((u) => u && !esNuestra(u)).slice(0, 3).forEach((u) => console.log(`      ${u}`));
        continue;
      }

      const nuevas = [];
      let cambio = false;
      for (const [i, url] of urls.entries()) {
        if (!url || esNuestra(url)) { nuevas.push(url); continue; }
        try {
          const nueva = await importarDesdeUrl(cual, p.id, nombreDe(cual, i), url);
          nuevas.push(nueva);
          cambio = true;
          migradas++;
          console.log(`      ✅ ${i + 1}/${urls.length}`);
        } catch (e) {
          // Se queda con la URL de ellos: mejor una foto que cuelga de un CDN
          // ajeno que una propiedad sin foto.
          nuevas.push(url);
          fallidas++;
          console.log(`      ⚠️  ${i + 1}/${urls.length}: ${e.message}`);
        }
      }

      if (cambio) {
        await actualizarCampos(cual, [{ id: p.id, campos: { [campo]: campo === 'imagen' ? nuevas[0] : nuevas } }]);
      }
    }
  }

  console.log(
    APPLY
      ? `\n✅ ${migradas} foto${migradas === 1 ? '' : 's'} en nuestro Storage${fallidas ? `, ${fallidas} que no se pudieron copiar` : ''}.`
      : `\n[dry-run] Se copiarían ${totalFotos} fotos. Correlo con --apply para hacerlo.`,
  );
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
