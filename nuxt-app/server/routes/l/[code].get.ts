// N4: real server-side resolution of trackable /l/:code links, replacing
// the old app's client-only page (app/src/pages/LinkRedirect.vue) that only
// resolved after the JS bundle loaded and used a client-side router.replace
// (so crawlers/link-preview bots never saw a real redirect at all). This
// file under server/routes/ registers an explicit Nitro/h3 route, which is
// matched before Nuxt's page-render catch-all — no Vue page needed here,
// since every outcome is either a redirect or a static message, never
// hydrated content.
//
// `links/{code}` shape (see app/functions/src/index.ts's
// createTrackableLink for the writer side): { active, propertyType:
// 'rental'|'sale', propertyId, sellerUid }. `firestore.rules` already
// allows a public `get` by exact doc ID (not `list`), so this needs no
// Admin SDK privileges — same public-read pattern the catalog pages rely
// on, via the shared server/utils/serverFirestore.ts helper.
//
// Two behaviors deliberately kept exactly as the old page had them (not
// bugs to "fix" here — see this milestone's brief):
// - The `es` locale is hardcoded on every redirect target regardless of
//   visitor language (matches @nuxtjs/i18n's prefix_except_default scheme,
//   where `es` is unprefixed at the root).
// - `?ref=<code>` is appended for lead-capture attribution
//   (app/src/composables/useLeadCapture.ts reads route.query.ref, with a
//   localStorage fallback). Neither Nuxt detail page reads it yet — N1
//   deliberately deferred porting the lead-capture UI — so this only
//   guarantees the query param survives the redirect for whenever that
//   composable/logic lands.
import { doc, getDoc } from 'firebase/firestore'

interface TrackableLink {
  active?: boolean
  propertyType?: 'rental' | 'sale'
  propertyId?: string
  sellerUid?: string
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')

  if (!code) {
    return sendRedirect(event, '/departamentos', 301)
  }

  const db = getServerFirestore()
  const snap = await getDoc(doc(db, 'links', code))
  const link = snap.exists() ? (snap.data() as TrackableLink) : null

  // Not found, or explicitly deactivated by the seller/admin — the old
  // page showed an inline message rather than redirecting; preserved here
  // rather than changing the UX, just making it server-rendered.
  if (!link || link.active === false) {
    setResponseStatus(event, 200)
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    // This page has nothing worth indexing (a dead/invalid short code) —
    // same intent as the old page's `useHead({ meta: [{ name: 'robots',
    // content: 'noindex' }] })`, expressed as a real header since this
    // response never goes through Nuxt's head management.
    setHeader(event, 'X-Robots-Tag', 'noindex')
    return renderInvalidLinkPage()
  }

  const ref = encodeURIComponent(code)

  if (link.propertyType === 'rental' && link.propertyId) {
    return sendRedirect(event, `/departamentos/${encodeURIComponent(link.propertyId)}?ref=${ref}`, 301)
  }
  if (link.propertyType === 'sale' && link.propertyId) {
    return sendRedirect(event, `/ventas/${encodeURIComponent(link.propertyId)}?ref=${ref}`, 301)
  }
  // Found, but no usable propertyType/propertyId (e.g. a link created with
  // no property attached yet) — send to the catalog root, still carrying
  // the ref code, matching the old page's else branch.
  return sendRedirect(event, `/departamentos?ref=${ref}`, 301)
})

function renderInvalidLinkPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>BairesRental</title>
</head>
<body>
<main style="max-width:640px;margin:4rem auto;padding:0 1.5rem;text-align:center;font-family:'DM Sans',sans-serif;">
  <p>Este link no es válido o ya no está activo.</p>
  <p><a href="/departamentos">Ver catálogo</a></p>
</main>
</body>
</html>
`
}
