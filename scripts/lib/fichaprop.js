// Lee una ficha pública de fichaprop.tech — el "link para colegas" de Tencery,
// el equivalente al de ficha.info de Tokko.
//
// Acá no hay nada para scrapear como en ficha.js: fichaprop.tech es un SPA de
// Vite, el HTML viene vacío y los datos los pide el navegador a Supabase. Así
// que este módulo hace exactamente lo mismo que hace la página, pero desde node:
//
//   1. `property_fichas?token=eq.<uuid>` → a qué propiedad apunta el link
//   2. `properties?id=eq.<uuid>`         → la propiedad, con barrio, fotos,
//                                          servicios e inmobiliaria
//
// El schema que devuelve es el mismo de Tencery que ya mapea add-from-tencery.js
// (`bedrooms`, `neighborhoods.name`, `pet_friendly`, `full_package`…), así que
// el mapeo se reusa tal cual.

const TIMEOUT_MS = 15000;

// El backend de fichaprop.tech y su clave *publishable*, las dos tal cual vienen
// adentro del bundle público del sitio (`/assets/index-*.js`). Es la clave que
// usa cualquier visitante desde el navegador para leer una ficha compartida, no
// un secreto nuestro. Si algún día fichaprop la rota, se actualiza acá.
const SUPABASE_URL = 'https://dfqgrmqwndofatfwfrxk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RdqZr8uGLEvhmchShCf4jg_q13OKhYq';

// El token de la ficha es el UUID que va en la URL.
const FICHAPROP_URL_RE = /^https?:\/\/(?:www\.)?fichaprop\.tech\/ficha\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

function esUrlDeFichaprop(url) {
  return FICHAPROP_URL_RE.test((url || '').trim());
}

function tokenDe(url) {
  const m = (url || '').trim().match(FICHAPROP_URL_RE);
  if (!m) throw new Error(`No parece una URL de fichaprop.tech: "${url}"`);
  return m[1].toLowerCase();
}

// Sin querystring, como en ficha.info: es la forma que se guarda en `fotos`.
function urlCanonica(url) {
  return `https://www.fichaprop.tech/ficha/${tokenDe(url)}`;
}

// ─── API ─────────────────────────────────────────────────────────────────────

// Lo que la página pide de `properties`, más lo que a nosotros nos sirve y ella
// no muestra: coordenadas, `full_package`, `available_from`, `rented_at`.
// `*` trae la fila entera, que es más corto que enumerar veinte columnas.
const SELECT_PROPIEDAD = [
  '*',
  'neighborhoods(name)',
  'agencies(name)',
  'property_images(image_url,display_order)',
  'property_services(is_included,services(name))',
].join(',');

async function api(path) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al pedir ${path.split('?')[0]} a fichaprop.tech`);
  }
  return resp.json();
}

// Devuelve { token, url, property }. Tira error en vez de devolver una
// propiedad a medias: mejor cortar que guardar una ficha vacía en el catálogo.
async function fetchFichaprop(url) {
  const token = tokenDe(url);

  const [ficha] = await api(`property_fichas?select=property_id&token=eq.${token}`);
  if (!ficha) {
    throw new Error('No encontré esa ficha en fichaprop.tech (¿el link se dio de baja?)');
  }

  const [property] = await api(`properties?select=${SELECT_PROPIEDAD}&id=eq.${ficha.property_id}`);
  if (!property) {
    throw new Error('La ficha existe pero la propiedad ya no es pública en fichaprop.tech');
  }

  return { token, url: urlCanonica(url), property };
}

module.exports = {
  esUrlDeFichaprop,
  urlCanonica,
  fetchFichaprop,
};
