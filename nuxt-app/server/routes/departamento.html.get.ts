// N4: ports app/functions/src/index.ts's `legacyDetailRedirect` Cloud
// Function into Nuxt server routing. The old function existed only
// because Firebase Hosting `rewrites`/`redirects` `source` matching can't
// see query strings at all (a real platform limitation — see the comment
// above `legacyDetailRedirect` in app/functions/src/index.ts), so a
// destination that depends on `?id=` needs real request-handling code, not
// a static rule. Ported here with the exact same `?id=` contract and
// missing/invalid-id fallback, but redirecting same-origin
// (`/departamentos/<id>`) instead of to the old `OLD_SITE_ORIGIN`
// (`https://www.bairesrental.com.ar`) — Nuxt itself is now the live site,
// so there's no separate "old site" to send visitors to anymore.
//
// `legacyDetailRedirect` itself is deliberately left deployed and
// untouched in app/functions/src/index.ts — deleting it is N5's job (the
// M8 rebuild-automation teardown), not this milestone's.
export default defineEventHandler((event) => {
  const { id } = getQuery(event)

  if (typeof id !== 'string' || !id) {
    return sendRedirect(event, '/departamentos', 301)
  }
  return sendRedirect(event, `/departamentos/${encodeURIComponent(id)}`, 301)
})
