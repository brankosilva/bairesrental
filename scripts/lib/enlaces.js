// "¿Este link sigue vivo?", para la auditoría semanal del catálogo.
//
// POR QUÉ NO ALCANZA CON EL STATUS. El caso que motivó esto devolvía **200**:
// `listadopropiedadesba.com`, donde estaban los álbumes de dos alquileres,
// venció como dominio y el registrador sirve una página de parking con
// `<title>Your domain is expired</title>`. Un chequeo de status lo daba por
// bueno. Por eso se miran cuatro señales, de más dura a más blanda:
//
//   1. la conexión no se abre (DNS, TLS)  → roto
//   2. status 4xx/5xx                     → roto
//   3. termina en otro dominio            → sospechoso (parking, dominio en venta)
//   4. 200 con cara de página de error    → sospechoso (mira el <title>)
//
// Las dos primeras son certezas; las otras dos van como "revisar", con el
// motivo textual al lado para que se vea de un vistazo si es real. Nada de esto
// toca el catálogo: el reporte es para que lo mire una persona.
//
// LO QUE NO MIRA, A PROPÓSITO: los álbumes de Google Photos y Drive. Un álbum
// revocado devuelve 200 y una app de JS que sin ejecutarla no dice nada, así
// que cualquier veredicto sería adivinado. Son la mayoría de los links del
// catálogo: llenar el Issue de los lunes de falsos positivos es peor que no
// mirarlos.

const TIMEOUT_MS = 12000;
const UA = 'Mozilla/5.0 (compatible; BairesRentalBot/1.0)';

const HOSTS_IGNORADOS = ['photos.google.com', 'photos.app.goo.gl', 'drive.google.com', 'docs.google.com'];

const PATRONES_MUERTO = [
  /domain (?:is |has )?expired/i,
  /dominio (?:ha )?expirad/i,
  /(?:buy|purchase) this domain/i,
  /this domain is for sale/i,
  /404\s*[-–—:|]?\s*(?:page )?not found/i,
  /p[áa]gina no encontrada/i,
  /account (?:is )?suspended/i,
  /sitio (?:web )?suspendido/i,
];

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function esIgnorado(url) {
  const h = host(url);
  return HOSTS_IGNORADOS.some(x => h === x || h.endsWith(`.${x}`));
}

function pedir(url, method) {
  return fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

// Devuelve { estado: 'vivo' | 'roto' | 'sospechoso' | 'ignorado', motivo }.
async function estadoDeEnlace(url) {
  const link = (url || '').trim();
  if (!link) return { estado: 'ignorado', motivo: 'sin link' };
  if (!/^https?:\/\//i.test(link)) return { estado: 'sospechoso', motivo: 'no es una URL http(s)' };
  if (esIgnorado(link)) return { estado: 'ignorado', motivo: 'álbum de Google: no se puede verificar sin ejecutar JS' };

  // HEAD primero: en una foto alcanza el status y no hace falta bajarla. Varios
  // servidores no lo implementan, así que se reintenta con GET antes de darlo
  // por roto.
  let resp;
  try {
    resp = await pedir(link, 'HEAD');
    if ([403, 405, 501].includes(resp.status)) resp = await pedir(link, 'GET');
  } catch {
    try {
      resp = await pedir(link, 'GET');
    } catch (e) {
      // DNS que no resuelve, TLS que no cierra, timeout. Acá cae el dominio
      // vencido cuando se lo pide por https.
      return { estado: 'roto', motivo: `no responde (${e.message})` };
    }
  }

  if (resp.status >= 400) return { estado: 'roto', motivo: `HTTP ${resp.status}` };

  const destino = host(resp.url || link);
  if (destino && destino !== host(link)) return { estado: 'sospechoso', motivo: `redirige a ${destino}` };

  const tipo = (resp.headers.get('content-type') || '').toLowerCase();
  if (!tipo.includes('html')) return { estado: 'vivo' };

  // Sólo acá vale la pena bajar el cuerpo: es una página, y una página que
  // responde 200 igual puede ser el cartel de otro.
  let html;
  try {
    html = await (await pedir(link, 'GET')).text();
  } catch {
    return { estado: 'vivo' }; // el status ya dijo que está en pie
  }

  const titulo = ((html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [])[1] || '').trim();
  const muerto = PATRONES_MUERTO.some(re => re.test(titulo) || re.test(html.slice(0, 4000)));
  return muerto
    ? { estado: 'sospechoso', motivo: `parece una página de error${titulo ? `: "${titulo.slice(0, 80)}"` : ''}` }
    : { estado: 'vivo' };
}

module.exports = { estadoDeEnlace, esIgnorado, HOSTS_IGNORADOS };
