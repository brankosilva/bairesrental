// Headers de un link compartible /l/:code, y el conteo de lo que NO es una
// persona.
//
// ¿POR QUÉ UN MIDDLEWARE Y NO LA PÁGINA?
//
// 1. Acá se ve la request REAL del visitante: su User-Agent y su
//    x-forwarded-for. Si esto viviera dentro del useAsyncData de la
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
// LAS APERTURAS DE PERSONAS YA NO SE CUENTAN ACÁ. Contar por request
// significaba contar recargas, el botón de atrás y cada ficha que el
// cliente mirara dentro del catálogo: el vendedor veía 12 aperturas de una
// sola persona. Ahora avisa el navegador desde
// api/l/[code]/open.post.ts, que es el único que sabe quién es (el id que
// guarda en localStorage) y no vuelve a avisar dentro de la misma media
// hora. Acá queda lo que nunca ejecuta JS y por lo tanto nunca pingea: los
// scrapers de preview, que siguen sumando a `botOpens` para que el filtro
// se pueda auditar.
//
// Corre en CADA request del sitio, así que el guard de path va primero y
// es estricto.
//
// El código dejó de ser 7 caracteres al azar: ahora sale del nombre del
// vendedor (/l/juan-perez) y, en los links aparte, de eso más el nombre del
// link (/l/juan-perez-monoambientes). Así que el patrón acepta guiones y
// hasta 80 caracteres: 40 del slug personal + 30 del sufijo + el separador y
// el "-2" de una eventual colisión. Los límites de cada parte los aplica
// functions/src/index.ts al armar el código — si allá se agrandan y acá no,
// el link existe pero sus aperturas no se cuentan en ningún lado.
const LINK_PATH = /^\/l\/([a-z0-9][a-z0-9-]{1,79})(?:\/([^/?#]+))?\/?$/i

export default defineEventHandler(async (event) => {
  const path = (event.path || '').split('?')[0] || ''
  if (!path.startsWith('/l/')) return

  // Esto no se cachea: si el CDN de Firebase Hosting respondiera sin pasar
  // por la función, la apertura no se registraría nunca. Y la página es la
  // versión de alguien de un catálogo que ya está indexado en su versión
  // pública: jamás indexable, o serían dos páginas compitiendo por lo mismo.
  setResponseHeader(event, 'cache-control', 'no-store, max-age=0')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')

  // Nuxt pide /l/abc/_payload.json al navegar del lado del cliente. No es
  // una apertura nueva: es la misma persona que ya está en la página.
  if (path.includes('/_payload')) return

  const match = LINK_PATH.exec(path)
  if (!match) return

  const code = match[1]!
  const propertyId = match[2] ? decodeURIComponent(match[2]) : null

  // Una persona: la cuenta su navegador cuando carga la página. Salir acá
  // ahorra además las lecturas de Firestore de abajo en el camino caliente.
  if (!classifyRequest(event, code).isBot) return

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
