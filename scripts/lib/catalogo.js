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
async function guardarPropiedad(cual, prop) {
  const { id, ...campos } = prop;
  if (!id) throw new Error('La propiedad no tiene `id`');
  // Firestore rechaza `undefined`; los JSON a veces traen campos sin valor.
  for (const k of Object.keys(campos)) if (campos[k] === undefined) delete campos[k];
  await getDb().collection(nombreColeccion(cual)).doc(id).set(campos);
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
