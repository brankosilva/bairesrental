// Una persona está mirando la página compartida.
//
// El conteo de aperturas humanas vive acá y no en el middleware porque el
// navegador es el único que sabe QUIÉN es: el id de visitante está en su
// localStorage (app/utils/linkVisitor.ts). Una cookie no sirve — Firebase
// Hosting borra todas las cookies entrantes salvo `__session`, que acá la
// usa la sesión de Auth.
//
// Lo que llega ya viene filtrado por el cliente: no pingea dos veces dentro
// de la misma media hora, ni cuando el navegador no le deja guardar el id.
// Los scrapers de preview de WhatsApp/Facebook no ejecutan JS, así que
// directamente no llegan; el filtro de User-Agent sigue puesto igual, para
// lo que se identifique mal.
//
// Es el mismo contrato que /click: se llama con sendBeacon, el cuerpo puede
// venir vacío y responde 204 sin contenido.
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  setHeader(event, 'cache-control', 'no-store, max-age=0')
  setResponseStatus(event, 204)
  if (!code) return null

  const query = getQuery(event)
  const visitorId = typeof query.v === 'string' ? query.v.slice(0, 64) : null
  // Sin id no hay forma de saber si es alguien nuevo o la misma persona
  // recargando, que es todo el punto de esto.
  if (!visitorId) return null

  const link = await resolveLink(code)
  if (!link || link.active === false) return null

  const propertyId = typeof query.p === 'string' ? query.p : null
  // Misma validación que hacía el middleware: sin esto, pingear
  // /api/l/<code>/open?p=<id-cualquiera> le sumaba aperturas al vendedor
  // con publicaciones que no puede mostrar.
  if (propertyId && !(await propertyShareableBySeller(propertyId, link.sellerUid))) return null

  await recordLinkEvent(event, link, {
    propertyId,
    visitorId,
    visitorIsNew: query.n === '1',
    // Sin `c=1` es alguien que ya venía mirando este link: queda el rastro
    // de qué publicación abrió, pero no es una apertura nueva.
    countOpen: query.c === '1',
    expectDocument: false,
  })
  return null
})
