// Registra la apertura de un link compartible /l/:code, y le pone a esa
// respuesta los headers que necesita.
//
// ¿POR QUÉ UN MIDDLEWARE Y NO LA PÁGINA?
//
// 1. Acá se ve la request REAL del visitante: su User-Agent y su
//    x-forwarded-for. Si el conteo viviera dentro del useAsyncData de la
//    página, durante el SSR ese fetch interno no arrastra los headers del
//    visitante salvo que uno se acuerde de useRequestFetch() — y el día
//    que alguien lo olvide, el filtro de bots empieza a clasificar todo
//    como "sin User-Agent" sin que falle nada visible.
//
// 2. Los headers tienen que salir SIEMPRE, incluso cuando el código no
//    existe o el link está apagado. Además `setResponseHeader` es de h3 y
//    no está auto-importado del lado de la app (sí `setResponseStatus`),
//    así que ponerlos desde el <script setup> de la página era directamente
//    un ReferenceError en SSR.
//
// Corre en CADA request del sitio, así que el guard de path va primero y
// es estricto.
const LINK_PATH = /^\/l\/([a-z0-9]{4,12})(?:\/([^/?#]+))?\/?$/i

export default defineEventHandler(async (event) => {
  const path = (event.path || '').split('?')[0] || ''
  if (!path.startsWith('/l/')) return

  // Un código de un solo uso no se cachea: si el CDN de Firebase Hosting
  // respondiera sin pasar por la función, la apertura no se registraría
  // nunca. Y la página es privada de un destinatario: jamás indexable.
  setResponseHeader(event, 'cache-control', 'no-store, max-age=0')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')

  // Nuxt pide /l/abc/_payload.json al navegar del lado del cliente. No es
  // una apertura nueva: es la misma persona que ya está en la página.
  if (path.includes('/_payload')) return

  const match = LINK_PATH.exec(path)
  if (!match) return

  const code = match[1]!
  const propertyId = match[2] ? decodeURIComponent(match[2]) : null

  const link = await resolveLink(code)
  // Los links inexistentes o apagados no suman: la página igual devuelve
  // 404/410, y contar aperturas de un link muerto sólo ensucia los números
  // del vendedor.
  if (!link || link.active === false) return

  // Una ficha abierta dentro de un link (/l/:code/:propertyId) sólo cuenta
  // si ese vendedor puede mostrar esa publicación. La página ya devuelve 404
  // si no, pero el conteo pasa por acá ANTES que la página, así que sin
  // este chequeo /l/<code>/<id-cualquiera> le sumaba aperturas igual.
  // Sólo paga la lectura extra la ruta anidada, que es la menos frecuente.
  if (propertyId && !(await propertyShareableBySeller(propertyId, link.sellerUid))) return

  await recordLinkEvent(event, link, { propertyId })
})
