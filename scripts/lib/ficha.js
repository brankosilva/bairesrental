// Lee una ficha pública de ficha.info (el "link para colegas" de Tokko Broker).
//
// ficha.info es una app Next.js que trae el JSON completo de la propiedad
// embebido en el HTML, repartido en chunks `self.__next_f.push([1,"..."])`.
// Reconstruyendo esos chunks se recupera el mismo objeto que devuelve la API de
// Tokko, así que una URL de ficha alcanza para cargar una propiedad entera: su
// clave `property` tiene exactamente la forma que `tokkoToProperty()` de
// add-from-tokko.js espera como `tokko.data`.
//
// Antes esto se resolvía con regex sobre el HTML crudo, matcheando las comillas
// escapadas de adentro de los chunks (`\"status\":{...`). Andaba para leer dos o
// tres campos sueltos, pero es frágil y ya se rompió una vez. Acá se parsea el
// objeto de verdad.
//
// OJO: esta lógica vive dos veces. La copia TypeScript está en
// nuxt-app/functions/src/ficha.ts, porque functions/ es un paquete aparte que no
// puede importar de scripts/. Si tocás una, tocá la otra.

const TIMEOUT_MS = 15000;

// Nombre de la inmobiliaria/cuenta Tokko bajo la que se publican las fichas.
// Si una ficha muestra una "company" distinta, la propiedad pasó a otra agencia.
const MI_INMOBILIARIA_TOKKO = 'GO NEGOCIOS INMOBILIARIOS';

// Las URLs que compartís vienen con un cache-buster (`?v=1789509778773`) que no
// aporta nada y ensucia el campo `fotos`. La forma canónica es sin querystring.
const FICHA_URL_RE = /^https?:\/\/(?:www\.)?ficha\.info\/p\/([0-9a-f]{8,64})(?:[/?#]|$)/i;

function esUrlDeFicha(url) {
  return FICHA_URL_RE.test((url || '').trim());
}

// https://ficha.info/p/HASH?v=123 → https://ficha.info/p/HASH
function urlCanonica(url) {
  const m = (url || '').trim().match(FICHA_URL_RE);
  if (!m) throw new Error(`No parece una URL de ficha.info: "${url}"`);
  return `https://ficha.info/p/${m[1].toLowerCase()}`;
}

// ─── Parseo del payload de Next.js ───────────────────────────────────────────

// Extrae el objeto JSON que arranca en `str[inicio]` balanceando llaves. Hay que
// ignorar las que caen adentro de strings: las descripciones de Tokko vienen con
// HTML y comillas escapadas.
function objetoDesde(str, inicio) {
  let nivel = 0;
  let enString = false;
  let escapado = false;

  for (let i = inicio; i < str.length; i++) {
    const c = str[i];
    if (escapado) { escapado = false; continue; }
    if (c === '\\') { escapado = true; continue; }
    if (c === '"') { enString = !enString; continue; }
    if (enString) continue;
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return JSON.parse(str.slice(inicio, i + 1));
    }
  }
  return null;
}

// Concatena los chunks del payload de Next.js en el texto original.
function payloadDeNext(html) {
  const chunks = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let texto = '';
  let m;
  while ((m = chunks.exec(html)) !== null) texto += JSON.parse(m[1]);
  return texto;
}

// Devuelve el objeto de datos de la ficha:
//   { property, edited_ficha, branch, operation_can_edit, hash, ... }
// Tira error si no lo encuentra, en vez de devolver campos vacíos que después
// se guardarían como una propiedad a medias.
function parseFicha(html) {
  const payload = payloadDeNext(html);
  if (!payload) {
    throw new Error('La ficha no trae el payload de Next.js (¿cambió el formato de ficha.info?)');
  }

  // El objeto de datos es el argumento del componente de la página. Se lo ubica
  // por su primera clave; si Next cambia el orden, se cae al objeto `property`
  // solo, que es de donde sale casi todo.
  for (const marca of ['{"public_view":', '{"show_contact":']) {
    const i = payload.indexOf(marca);
    if (i >= 0) {
      const obj = objetoDesde(payload, i);
      if (obj && obj.property) return obj;
    }
  }

  const iProp = payload.indexOf('"property":{');
  if (iProp >= 0) {
    const property = objetoDesde(payload, payload.indexOf('{', iProp + '"property":'.length - 1));
    if (property) return { property };
  }

  throw new Error('No encontré los datos de la propiedad en la ficha (¿cambió el formato de ficha.info, o la ficha no existe?)');
}

async function fetchFicha(url) {
  const resp = await fetch(urlCanonica(url), {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (BairesRental catalog importer)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} al pedir la ficha`);
  return parseFicha(await resp.text());
}

// ─── Lecturas puntuales ──────────────────────────────────────────────────────

// Tokko no usa un booleano simple: el campo "status" puede venir como
// "Disponible", "No disponible", "Tasación", "Alquilada", etc. Cualquier
// valor que no sea exactamente "disponible" cuenta como NO disponible.
// OJO: no uses /disponible/i.test(status) para esto — "No disponible"
// también matchea esa regex por contener la palabra "disponible", lo que
// hace que el chequeo nunca detecte una ficha caída. Ya pasó antes.
function esDisponibleSegunTokko(status) {
  if (!status) return null;
  return /^disponible$/i.test(status.trim());
}

// Lo que mira la auditoría semanal: estado en Tokko y bajo qué agencia aparece.
function estadoDeFicha(ficha) {
  const property = ficha.property || {};
  return {
    status: property.status?.name || null,
    company: property.company?.name || ficha.branch?.company?.name || null,
    branch: ficha.branch?.name || null,
    active: property.active === undefined ? null : property.active,
  };
}

module.exports = {
  MI_INMOBILIARIA_TOKKO,
  esUrlDeFicha,
  urlCanonica,
  parseFicha,
  fetchFicha,
  esDisponibleSegunTokko,
  estadoDeFicha,
};
