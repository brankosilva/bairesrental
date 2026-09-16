// Registra que alguien tocó el botón de contacto en una página compartida.
//
// Es la única señal de conversión que tiene el sistema hoy. La captura de
// leads (un formulario de nombre + teléfono antes de mandar a WhatsApp)
// nunca se portó a Nuxt, y para este caso de uso tampoco corresponde:
// poner un formulario adelante de una página que el vendedor le mandó a
// UNA persona con nombre y apellido es fricción sobre la conversión misma
// que se quiere medir. El vendedor ya sabe quién es; lo que no sabe es si
// abrió y si quiso contactarlo.
//
// Se llama con navigator.sendBeacon() desde el botón de WhatsApp, así que:
//  · el cuerpo puede venir vacío — no se parsea nada;
//  · responde 204 sin contenido, porque nadie lee la respuesta;
//  · no puede fallar de forma visible: la navegación a WhatsApp sigue
//    igual pase lo que pase acá.
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  setHeader(event, 'cache-control', 'no-store, max-age=0')

  if (!code) {
    setResponseStatus(event, 204)
    return null
  }

  const link = await resolveLink(code)

  // Un link inexistente o desactivado no suma. Igual se responde 204: esto
  // no es una API pública que tenga que explicar errores, y contestar 404
  // sólo serviría para que alguien pueda sondear qué códigos existen.
  if (link && link.active !== false) {
    const query = getQuery(event)
    await recordLinkEvent(event, link, {
      type: 'whatsapp',
      propertyId: (query.p as string | undefined) ?? null,
      // El mismo id que manda el ping de apertura, para que el contacto
      // quede pegado a la persona que abrió y no a un visitante fantasma.
      visitorId: typeof query.v === 'string' ? query.v.slice(0, 64) : null,
      // sendBeacon manda `Accept: */*`: sin esto, el clic de contacto queda
      // marcado como bot y el detalle de actividad lo esconde entre los
      // scrapers.
      expectDocument: false,
    })
  }

  setResponseStatus(event, 204)
  return null
})
