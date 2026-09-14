// N4: ports app/functions/src/index.ts's `legacyVentaDetailRedirect`
// Cloud Function into Nuxt server routing — see the sibling
// `departamento.html.get.ts` for the full rationale (same `?id=`
// query-string limitation on Hosting's static `redirects`/`rewrites`
// matching, same same-origin-instead-of-OLD_SITE_ORIGIN change, same
// "old function stays deployed until N5" note).
export default defineEventHandler((event) => {
  const { id } = getQuery(event)

  if (typeof id !== 'string' || !id) {
    return sendRedirect(event, '/ventas', 301)
  }
  return sendRedirect(event, `/ventas/${encodeURIComponent(id)}`, 301)
})
