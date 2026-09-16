// Lectura y escritura del catálogo en Firestore, para que los scripts no
// tengan que saber de colecciones ni de la forma de los documentos.
//
// `rentals` = alquiler temporario (antes data/departamentos.json)
// `sales`   = venta              (antes data/ventas.json)

const { getDb } = require('./firestore');

const COLECCIONES = { alquileres: 'rentals', ventas: 'sales' };

function nombreColeccion(cual) {
  const col = COLECCIONES[cual];
  if (!col) throw new Error(`Catálogo desconocido: "${cual}" (usá "alquileres" o "ventas")`);
  return col;
}

// Devuelve el catálogo entero como array, con la misma forma que tenían los
// JSON: el id adentro de cada objeto, no como clave del documento.
async function leerCatalogo(cual) {
  const snap = await getDb().collection(nombreColeccion(cual)).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Alta o actualización. El `id` de la propiedad es el id del documento, así que
// volver a guardar el mismo id pisa el anterior — el mismo comportamiento que
// tenía el `--update` sobre el JSON.
//
// `{ merge: true }` Y EL DEFAULT DE `revision` NO SON PROLIJIDAD: son las dos
// maneras conocidas de que una propiedad desaparezca del sitio sin que nadie se
// entere.
//
// El `.set()` pelado que había acá reemplazaba el documento ENTERO, así que
// correr `add-from-tokko.js --update` sobre una propiedad ya cargada le borraba
// todos los campos que el script no manda: `sellerUid`, `ownerUid`,
// `updatedAt`. Desde que existe la revisión, además le borraría `revision`, y
// eso sí se nota en el sitio: la query pública es
// where('revision','==','aprobada') y un `where` de igualdad NO matchea
// documentos sin el campo. O sea que la propiedad se caía del catálogo y del
// sitemap, en silencio, por reimportarla.
//
// El default es 'aprobada' porque estos scripts los corre el admin desde la
// línea de comandos: lo que carga un admin no pasa por revisión. Lo que carga
// un vendedor entra por el panel, que sella 'pendiente'.
async function guardarPropiedad(cual, prop) {
  const { id, ...campos } = prop;
  if (!id) throw new Error('La propiedad no tiene `id`');
  // Firestore rechaza `undefined`; los JSON a veces traen campos sin valor.
  for (const k of Object.keys(campos)) if (campos[k] === undefined) delete campos[k];
  if (campos.revision === undefined) campos.revision = 'aprobada';
  await getDb().collection(nombreColeccion(cual)).doc(id).set(campos, { merge: true });
  return id;
}

// Actualiza campos sueltos de varias propiedades de una (máximo 500 por lote,
// que es el límite de un batch de Firestore).
async function actualizarCampos(cual, cambios) {
  const db = getDb();
  const col = nombreColeccion(cual);
  for (let i = 0; i < cambios.length; i += 400) {
    const batch = db.batch();
    for (const { id, campos } of cambios.slice(i, i + 400)) {
      batch.update(db.collection(col).doc(id), campos);
    }
    await batch.commit();
  }
  return cambios.length;
}

module.exports = { leerCatalogo, guardarPropiedad, actualizarCampos, nombreColeccion };
