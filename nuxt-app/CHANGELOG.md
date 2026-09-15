# Migration log — Nuxt SSR rewrite

## N8 — Admin `Usuarios` becomes a real CRUD

`/app/admin/users` was the only admin screen that wasn't one: it could
invite a user (C) and list users (R), but the only thing editable was the
role, and there was no way to remove anyone — `admin/rentals.vue` and
`admin/sales.vue` have had edit + delete since N3.

### Why every write is a Cloud Function

`firestore.rules` has `allow write: if false` on `/users/{uid}` (since M4),
because a role lives in **two** places that must never drift: the Firestore
profile doc and the Firebase Auth custom claim that `app/middleware/auth.ts`
actually enforces. Only the Admin SDK can write both, so this screen gets
two new callables rather than the `saveOne`/`removeOne` helpers the listing
screens use. **No rules change was needed or made.**

### Functions (`functions/src/index.ts`) — `default` codebase now has 11

1. **`updateUser`** (new, admin-only). Every field optional, only the ones
   present in the payload are touched, so the same callable serves both the
   row's inline edit (name / phone / role) and the suspend toggle without
   either clobbering the other.
   - `displayName` is mirrored into Firebase Auth; **`phone` deliberately
     is not.** Auth's `phoneNumber` must be a globally-unique E.164 value
     tied to phone sign-in, so an ordinary contact number like
     `11 7373-5757` would fail the whole update. It stays a Firestore
     profile field, the same way `leads` stores one.
   - `disabled` maps to Auth's own disabled flag (a reversible "baja"), and
     is mirrored into the profile doc so the list can render the state
     without a `listUsers()` scan.
2. **`deleteUser`** (new, admin-only). Deletes the Auth account *and* the
   profile, with three guards:
   - **Not yourself** (`uid === request.auth.uid`).
   - **Not the last admin** — shared `assertNotLastAdmin()` helper, also
     applied when demoting or suspending. Recovering from locking every
     admin out needs service-account credentials and a manual re-run of
     `functions/scripts/bootstrap-admin.js`, so it's refused up front.
   - **Not while they still hold listings** — four `count()` aggregations
     over `rentals`/`sales` × `sellerUid`/`ownerUid`. It **refuses and says
     how many** instead of cascading: a listing whose seller resolves to
     nobody stays on the public catalog, and reassigning a property is a
     business decision, not a side effect of removing a login.
   - `links` owned by the user are **deactivated, not deleted** — `leads`
     reference them by `linkId`, so deleting them would break the
     attribution history of leads that seller already brought in.
   - Auth is deleted before the profile on purpose: a leftover profile doc
     is an orphan visible in this very screen and retryable, whereas the
     reverse order could leave an account that can still sign in with no
     profile row to find it by. `auth/user-not-found` is swallowed so a
     profile whose Auth user was removed from the console can still be
     cleaned up here.
3. **`onUserCreate` race fixed** (pre-existing bug, found while wiring the
   invite form). It wrote the profile with a plain non-merge `set`
   including `role: null`. That trigger fires asynchronously a beat *after*
   `createUser()` returns inside `inviteUser`, so it could land **after**
   `inviteUser` had written the assigned role and silently reset it to
   null — the invited user would then log in to the "sin rol" dashboard.
   Now a transaction reads first and never overwrites an existing `role`
   or `createdAt`, making the trigger idempotent.
4. **`inviteUser`** additionally accepts optional `displayName` / `phone`,
   and only overwrites those fields when they're actually filled in (so
   re-inviting an existing user with the name box empty can't wipe the name
   they already have).
5. **`setUserRole` kept, unchanged, no longer called by the UI.** Stable
   endpoint documented since M4; `updateUser` supersedes it (same role
   write, plus the rest of the profile and the last-admin guard). Removing
   a deployed function is its own deliberate deploy, not a side effect of
   this one.
6. Shared `requireAdmin(request, mensaje)` replaces the `signed in` +
   `is admin` pair each admin-only callable inlined, keeping each one's
   original user-facing wording verbatim.

### Page (`app/pages/app/admin/users.vue`)

Invite panel gains name + phone; the table gains name / phone / estado
columns, a search box matching `admin/rentals.vue`, inline per-row edit
(one row at a time, cancel restores without a reload), a
suspend/reactivate toggle, and delete. Self-row is badged `vos` with
suspend and delete disabled; demoting **yourself** is allowed but
confirms first, since you lose the panel as soon as the ID token
refreshes. `failed-precondition` messages from the backend (the listing
count, the last-admin refusal) surface in a banner instead of an `alert()`
— they're the admin's cue for what to do next, not just a failure.

### Verification

- `npm --prefix functions run build` (`tsc`) — clean.
- `npm run build` (Nuxt) — clean; only the pre-existing chunk-size warning.

## N7 — Two sitemap fixes + cutover: `bairesrental.web.app` now serves Nuxt

The final milestone of this plan. Fixed the two real (non-blocking) gaps
N6's QA found, verified them on a fresh preview channel, then — with the
user's explicit approval — cut `bairesrental.web.app`'s live/default
Hosting release over from the old Vue app (`app/`) to this Nuxt app. Since
DNS for the real customer domain (`www.bairesrental.com.ar`) still points
at GitHub Pages, serving the pre-migration static site, and nothing else
resolves to `bairesrental.web.app`, this cutover carries **zero real
customer-traffic risk** — it only changes what Firebase's own testing
subdomain serves.

### Part 1 — Sitemap fixes

1. **English sitemap missing all 88 dynamic listing URLs**
   (`server/api/__sitemap__/urls.ts`). Root cause, confirmed by reading
   `@nuxtjs/sitemap`'s own runtime source
   (`node_modules/@nuxtjs/sitemap/dist/runtime/server/sitemap/builder/
   entries.js`'s `resolveSitemapEntries()`), not guessed: a bare
   `{ loc: '/departamentos/<id>' }` entry from a *runtime* source is
   treated as an already-localized `es` URL; it only gains an `en`
   alternate if some other source entry happens to share the same
   locale-stripped path, which never happens here since the source never
   emits an `/en/...` counterpart itself. The fix — documented as exactly
   this in `@nuxtjs/sitemap`'s own type definitions
   (`SitemapUrl._i18nTransform`) — is to set `_i18nTransform: true` on each
   entry, which makes the module call its own `resolveI18nRouteEntries()`
   on the bare path and synthesize the full set of locale variants (`es`
   at the bare path, `en` under `/en/...`) plus correct hreflang
   alternates (including `x-default`) on each one, the same mechanism
   `i18n.pages`-derived static routes already use internally.
2. **Sitemap included `/app/**` routes** despite `robots.txt` disallowing
   `/app/` outright. Added `sitemap.exclude: ['/app/**', '/en/app/**']` to
   `nuxt.config.ts`.

**Evidence — local (`npm run dev`), before N6 had already established the
"before" state (0 `en-US` listing URLs, 88 `es-AR`, `/app/**` present in
both), so this confirms the "after" only:**

| Sitemap | Total `<loc>` | Listing URLs | `/app/**` URLs |
|---|---|---|---|
| `es-AR.xml` | 92 (4 static + 88 listings) | 88 | 0 |
| `en-US.xml` | 92 (4 static + 88 listings) | 88 | 0 |

Sample entry confirmed with correct hreflang alternates (`x-default`,
`es-AR`, `en-US`) on both the `es` and `en` variant of the same listing
(`/departamentos/Baires` ↔ `/en/departamentos/Baires`).

**Re-verified identically after deploying to a fresh preview channel**
(`firebase deploy --only functions:nuxtssr` then
`firebase hosting:channel:deploy n7-sitemap-fix` →
`https://bairesrental--n7-sitemap-fix-y6t2c1jm.web.app`, expires
2026-09-20): same 92/92 totals, 88/88 listing URLs, 0/0 `/app/**` URLs on
both `__sitemap__/es-AR.xml` and `__sitemap__/en-US.xml` — before moving to
Part 2, live site (`bairesrental.web.app`) reconfirmed untouched
(`<html lang="es">`, `logo-perfin-redes.png`, the old Vue app's exact
fingerprint) at this point.

### Part 2 — Cutover

1. **Before state, recorded**: `firebase functions:list --project
   bairesrental` showed the same 8 pre-existing functions
   (`createTrackableLink`, `legacyDetailRedirect`,
   `legacyVentaDetailRedirect`, `setUserRole`, `submitLead`,
   `uploadListingImage`, `onUserCreate`) plus `nuxtSsr` — 9 total, already
   deployed from earlier milestones. `curl -sI
   https://bairesrental.web.app/` + body fingerprint: `200`, `<html
   lang="es">`, `logo-perfin-redes.png`, `<title>Gestión de Alquileres
   Temporarios en Buenos Aires | BairesRental</title>` — the old Vue app,
   exactly as every prior milestone confirmed.
2. Deployed the Nuxt Cloud Function first (sitemap fixes included in the
   build): `firebase deploy --only functions:nuxtssr` from `nuxt-app/`
   (N0 gotchas re-applied: `firebase-functions` pin held at `6.6.0` in
   `.output/server/package.json`; `.output/server` pruned + `npm install
   --omit=dev` before deploying).
3. Deployed Hosting to the **live/default** channel — the actual cutover:
   `firebase deploy --only hosting` from `nuxt-app/` (with
   `nuxt-app/firebase.json` as the active config, `.firebaserc` already
   defaulting to project `bairesrental`). Not `hosting:channel:deploy`, not
   a bare `firebase deploy`.
4. **After state, verified immediately, all against the real live
   `https://bairesrental.web.app` — the first time any of this migration's
   work has been checked against the actual live release rather than a
   preview channel:**
   - `curl -sI https://bairesrental.web.app/` → `200`, `x-powered-by:
     Nuxt` (new header, never present on the old Vue app's static-file
     responses). Body: `<html lang="es-AR" dir="ltr">` (was `<html
     lang="es">`, no `dir`), `logo-perfin-redes.png` now absent, same
     `<title>` text (expected — same brand copy, different rendering
     stack), 1 JSON-LD block on the home page.
   - Real rental detail page (`/departamentos/Baires`): real per-listing
     `<title>Moderno estudio con amenities en Palermo — BairesRental</title>`,
     canonical
     (`https://www.bairesrental.com.ar/departamentos/Baires`), 5 hreflang
     alternates (`x-default`, `es`, `es-AR`, `en`, `en-US`), 1 JSON-LD
     block — all server-rendered, `curl`-visible, no JS.
   - EN toggle: `/en/departamentos/Baires` → `<html lang="en-US"
     dir="ltr">`, same listing content — confirms the i18n routing works
     against the real live release.
   - N4 legacy redirect: `GET /departamento.html?id=Baires` → `301 ->
     https://bairesrental.web.app/departamentos/Baires`.
   - Unauthenticated `/app/admin/rentals` (a real gated route — bare
     `/app/admin` 404s, it was never a route) → real `302` to
     `/app/login?redirect=/app/admin/rentals`, no protected content in the
     body — server-enforced auth confirmed live in production, not just on
     a preview channel.
   - Sitemap re-checked against the now-live domain:
     `https://bairesrental.web.app/__sitemap__/en-US.xml` → 88 listing
     URLs, 0 `/app/**` URLs — both Part 1 fixes hold on the real live
     release too.
5. **`firebase functions:list --project bairesrental` re-run after the
   Hosting deploy** — `diff`ed byte-for-byte against the before-state
   captured in step 1: **zero drift**. Same 9 functions, same versions,
   same regions. A Hosting deploy does not touch Cloud Functions, and this
   confirms it, rather than assuming it.
6. **`app/` confirmed untouched**: no files under `app/` were read for
   editing, written to, or deleted this milestone (only `app/firebase.json`
   and `app/dist/` were inspected, read-only, to confirm the rollback path
   below is real and pre-built, not to hypothesize about it). `app/dist/`
   already exists (built earlier, timestamped before this milestone) —
   **the rollback command below can run immediately, with no rebuild
   step, if anything is ever found wrong post-cutover**:
   ```
   cd app && firebase deploy --only hosting --project bairesrental
   ```
   This restores the old Vue app to `bairesrental.web.app` in one command,
   using `app/firebase.json`'s own config (`public: dist`) — verified the
   preconditions for this (the config file and the built `dist/` output)
   are both present and unmodified; the command itself was **not**
   executed, since running it would immediately undo the cutover just
   performed.

### Explicitly out of scope, untouched

`www.bairesrental.com.ar` — the real customer-facing domain — is **not**
affected by any of this. It remains pointed at GitHub Pages, serving the
original pre-migration static HTML site, exactly as it was before this
milestone and before this entire migration began. No DNS changes, registrar
actions, or custom-domain configuration were made or attempted. Repointing
that domain at Firebase Hosting is explicitly a separate, future, much
bigger decision — not part of this plan.

### Verification summary

- Sitemap fixes: verified locally, then re-verified identically on a fresh
  deployed preview channel, before being included in the cutover build.
- Cutover: before/after `curl` fingerprints (`<html lang="es">` →
  `<html lang="es-AR" dir="ltr">` + `x-powered-by: Nuxt`), a real detail
  page's SSR'd SEO metadata, the ES/EN toggle, an N4 redirect, and
  server-enforced auth on a protected route — all reverified directly
  against `https://bairesrental.web.app` post-cutover, not a preview
  channel.
- `firebase functions:list` before/after: identical, confirmed by `diff`.
- `app/` intact, rollback path confirmed viable but not executed.
- `www.bairesrental.com.ar` unaffected, still GitHub Pages — out of scope.

## N6 — Full regression QA on a fresh preview channel (go/no-go)

QA-only milestone, per the approved plan's N6 scope: no cutover, no
production Hosting change — a single comprehensive regression pass across
everything built in N0–N5 together, on one fresh preview channel, plus a
go/no-go recommendation. Full detail (commands, evidence, findings) is in
this milestone's own report; short version below.

**Verdict: GO, with one real (non-blocking) gap to fix before or shortly
after cutover** — the English sitemap gap (below). Everything else
checked out clean: all three roles' server-enforced auth, all CRUD +
image upload + role assignment, all redirects (static, legacy `?id=`,
`/l/:code` × 5 cases), real per-request SSR SEO metadata on both locales
of both detail-page types, the i18n toggle both directions, the N4-prep
fixes (fonts, featured-listings section, reviews marquee, no
English-auto-redirect) all still holding, and the live production site
completely untouched throughout.

- **Setup**: `npm run build` (firebase-functions pin held at `^6.6.0` in
  both `package.json`/`.output/server/package.json`), `.output/server`
  pruned + `npm install --omit=dev` (N0 gotcha #2, still required),
  `firebase deploy --only functions:nuxtssr`, then
  `firebase hosting:channel:deploy n6-qa` →
  `https://bairesrental--n6-qa-igah6v1o.web.app` (expires 2026-09-20).
  `firebase functions:list` before and after the function deploy: all 8
  functions (`createTrackableLink`, `legacyDetailRedirect`,
  `legacyVentaDetailRedirect`, `setUserRole`, `submitLead`,
  `uploadListingImage`, `onUserCreate`, plus `nuxtSsr` itself) identical
  both times.
- **Public catalog, both locales**: real listing IDs pulled by curling the
  app's own public catalog pages (not a raw Admin SDK production read —
  this session's auto-mode classifier correctly refused a direct
  script-based Firestore read of real customer data as a "Production
  Reads" action; reading it through the same public page real visitors
  hit is the intended, safe equivalent). `/departamentos` (66 real cards)
  and `/ventas` (3 real cards) render with real filters. A real rental
  (`Baires`) and real sale (`lafinur-3000`) detail page, in both `/…` and
  `/en/…`, all `curl`ed with no JS: real per-listing `<title>`, canonical,
  5 hreflang alternates, and exactly one JSON-LD block each — confirmed
  both locally and against the deployed channel. 404 case
  (`/departamentos/no-existe-…`) still returns `200` +
  `noindex` + the expected not-found title. Home page's N4-prep featured
  section shows 6 real cards linking to real, currently-live listing ids
  (`Baires`, `Baires-poli-2`, `Vera-0`, `baires-4`, `casa-duggan`,
  `poli-05`) — confirmed live, not stale. Reviews marquee still uses the
  N4-prep `.review-quote` class (33 occurrences, not reverted to the
  colliding `.review-text`). `/tickets` 200s.
- **Real headless-browser check** (Chrome via the DevTools Protocol,
  `--remote-debugging-port`, same method N4-prep's gotcha section
  documented — `curl` can't exercise cookies/JS/click-navigation): fresh
  load of `/` stays on `/` (`es-AR`, no `i18n_redirected` cookie — the
  N4-prep fix holds), one click on the `.br-lang-btn` nav toggle reaches
  `/en` (`en-US`), a second click returns to `/` (`es-AR`) — both
  directions confirmed. Zero console errors/warnings/exceptions observed
  during the whole session. Caveat: Vue only emits its hydration-mismatch
  dev warnings in development builds, not the production build this
  preview channel serves, so this check cannot confirm whether N4-prep's
  previously-flagged, deliberately-deferred `home.planes` list hydration
  warning is still present — it simply can't reproduce in this build
  either way, consistent with (not contradicting) that entry.
- **Sitemap — real bug found, not previously caught**: `/sitemap.xml` →
  `sitemap_index.xml` → per-locale files as expected, but
  `__sitemap__/en-US.xml` contains **zero** of the 88 dynamic
  rental/sale listing URLs (only the 13 static/app-shell routes) while
  `__sitemap__/es-AR.xml` correctly has all 88 (101 total) — confirmed
  identically on local dev and the deployed channel. N1's dynamic source
  (`server/api/__sitemap__/urls.ts`) returns bare `{ loc: '/departamentos/<id>' }`
  entries with no locale metadata, and `@nuxtjs/sitemap`'s `autoI18n`
  apparently only expands *statically-discovered* page routes into both
  locales, not runtime-source entries — so no `/en/departamentos/<id>`
  or `/en/ventas/<id>` URL, and no `en-US` hreflang alternate on the
  Spanish entries either, ever reaches a sitemap. Real, if non-blocking,
  SEO gap for the English site specifically (Google can still reach these
  pages via internal links/hreflang tags on the pages themselves, just
  not via the sitemap) — worth a follow-up fix (emit both locale variants
  from the source, or add explicit `_i18n-alternates` per entry) before
  or shortly after cutover, not a cutover blocker on its own.
  - Also noted, minor: the sitemap includes every `/app/**` route
    (`/app/login`, `/app/admin/rentals`, etc.) despite `robots.txt`
    disallowing `/app/` — harmless (still disallowed, still behind real
    auth) but inconsistent; `@nuxtjs/sitemap`'s auto-discovery doesn't
    know these are gated pages. Not previously flagged.
- **Redirects — all reverified against the fresh deployed channel, all
  pass** (one `curl` per external call, per N1's documented gotcha — a
  `for`-loop batch intermittently failed with a phantom "command not
  found: curl" again this run, exactly as before): all 6 static
  `firebase.json` redirects, `departamento.html`/`detalle-venta.html`
  with and without `?id=`, and all 5 `/l/:code` cases (rental → 301 with
  `?ref=`, sale → 301 with `?ref=`, no-propertyId → 301 to bare catalog,
  inactive → 200 `noindex` message, nonexistent → 200 `noindex` message)
  using 4 fresh disposable `links/{code}` docs (`n6qa-rental`/`-sale`/
  `-nopid`/`-inactive`), all deleted and confirmed gone immediately after.
- **Auth + all three roles**, using 5 fresh disposable users created via
  the Admin SDK (`n6qa-admin-temp`, `n6qa-roletarget-temp`,
  `n6qa-sellera-temp`, `n6qa-sellerb-temp`, `n6qa-owner-temp`, all
  `@bairesrental.com.ar`) and the real client SDK/callables against the
  deployed channel — 26/26 scripted checks passed:
  - Unauthenticated `curl` of `/app/dashboard` and `/app/admin/rentals` →
    real `302` to `/app/login?redirect=…` with a bare refresh-shell body,
    no protected content, no cookie needed to prove it.
  - **Admin**: session cookie mint (`201`), reached `/app/admin/rentals`
    authenticated; `setUserRole` callable really flipped the disposable
    role-target user's custom claim to `seller` (confirmed via a
    follow-up Admin SDK read before cleanup); full rental CRUD
    (create/edit/delete) and full sale CRUD via the same client Firestore
    calls the UI makes; a real 1×1 PNG uploaded via `uploadListingImage`
    for both a rental and a sale, both returned URLs publicly fetchable
    (`200`, `image/png`) before cleanup.
  - **Seller A / Seller B isolation**: each created their own rental
    (`sellerUid` = self, passes `firestore.rules`), their own trackable
    link via `createTrackableLink`, and received a real lead via a public
    `submitLead` call against their own link code. Each seller's own
    `sellerUid`-filtered query on `links`/`leads` returned only their own
    doc. **Negative case**: seller B querying seller A's `links`/`leads`
    by `sellerUid` was rejected with a real `permission-denied` from
    `firestore.rules` (not just "the UI wouldn't show it") — both checks
    PASS.
  - **Owner**: reached `/app/owner` authenticated; an `ownerUid`-tagged
    rental (tagged via a brief admin re-sign-in) was correctly returned
    by the owner's `ownerUid`-filtered query.
  - **Wrong-role redirect**: seller A hitting the admin-only
    `/app/admin/rentals` with their own valid session cookie got a real
    `302` to `/app/dashboard`, not the admin content.
  - **Cleanup, independently reverified**: a separate follow-up Admin SDK
    script confirmed all 5 disposable Auth users gone, all 5 `users/`
    docs gone, all 3 disposable rental/sale docs gone, 0 leftover
    `links`/`leads` docs for either disposable seller, and both uploaded
    test Storage objects gone. Never touched the shared
    `test-admin`/`test-seller` fixtures.
- **Contact form (Web3Forms)**: the client-side POST fires with the
  correct payload from a real (headless but real-engine) browser session
  — confirmed via a real DOM fill + click + Network-domain capture over
  CDP, not just reading the code. The actual submission came back `403`
  both from that real browser and from direct `curl`, and a `curl` with a
  normal desktop Chrome UA hit a Cloudflare "Just a moment…" bot
  challenge outright — this looks like Web3Forms/Cloudflare bot-detection
  reacting to this sandboxed test environment's network/IP and/or
  headless-Chrome fingerprint specifically (the exact same direct-fetch
  pattern, same access key, is unchanged from the old app, which M7's own
  history already established works for real visitors and rejects
  server-to-server calls). Deliberately did not keep retrying against
  Web3Forms' bot defenses. **Not confirmed clean** — recommend one real
  submission from an ordinary human browser/network (not this sandbox)
  before fully trusting the contact form on the cutover domain, though
  there's no code-level reason to expect it fails there.
- **Polish/risk notes, not blockers**: `firebase deploy` printed a
  Node.js 20 deprecation warning (decommissioned 2026-10-30 per Google's
  posted timeline) — worth a Node 22 runtime bump at some point, not
  urgent for this milestone. Observed a ~1.2s response time for a warm
  detail-page request from this (non-Argentina) test environment —
  plausible given the `southamerica-east1` region plus a cross-continental
  test path, not evidence of a real cold-start problem, but worth an eye
  on real-user latency post-cutover. Detail-page `<title>`/description
  don't actually translate on `/en/...` pages — expected, not a bug: the
  underlying Firestore `titulo`/`descripcion` fields are single-language
  source data, same as every other milestone.
- **Live site untouched**: `firebase functions:list` diff showed zero
  drift (same 8 functions + `nuxtSsr`, matching before/after), and
  `curl https://bairesrental.web.app/` still returns the old Vue app's
  exact fingerprint (`<html lang="es">`, `logo-perfin-redes.png`)
  throughout and after this entire QA pass.

### Go/no-go

**GO for cutover**, conditional on the team being fine shipping with the
English-sitemap gap open as a fast-follow (it's a discoverability gap for
`/en/*` listing pages specifically, not a functional break — the pages
themselves render correctly and carry correct hreflang tags, they're just
not enumerated in the sitemap yet) and doing one manual real-browser
contact-form submission on the actual cutover domain before fully trusting
it (this sandbox's network could not get a clean answer either way).
Nothing found in this pass rises to "broken" for a real visitor or for any
of the three authenticated roles. Cutover itself (pointing
`bairesrental.web.app`'s live Hosting release at this app) was
deliberately not performed — that decision stays with the user, per this
milestone's brief.

## N5 — M8 rebuild-automation teardown

Deleted the now-unnecessary M8 rebuild-automation subsystem from the old
Vue app's backend, per this plan's original scope ("The entire M8
rebuild-automation subsystem is deleted, not ported"). All the actual file
changes live in the old `app/` tree, not here — see
`app/CHANGELOG.md`'s own N5 entry for the full account (what was deleted,
the real before/after `firebase functions:list` diff, and verification
that the live site and every other function, including `nuxtSsr`, are
unaffected). Short version: `onRentalWrite`/`onSaleWrite`/
`scheduledRebuildCheck` and `.github/workflows/rebuild-and-deploy.yml` are
gone; `legacyDetailRedirect`/`legacyVentaDetailRedirect` (N4's Nuxt-side
equivalents already exist, see below) are deliberately left deployed until
the N6 cutover. Nothing in `nuxt-app/` itself changed this milestone.

## N4 — `/l/:code` trackable-link resolution + legacy URL redirects (real server routes)

Built the three pieces of N4 scope from the approved plan
(`~/.claude/plans/declarative-swimming-backus.md`), all as real Nitro
server routes under `nuxt-app/server/` rather than client-only pages or
separate Cloud Functions — matched before/after with `firebase
functions:list` and verified against a real deployed Hosting preview
channel, not just local dev.

- **`/l/:code` → real server-side 301** (`nuxt-app/server/routes/l/
  [code].get.ts`): replaces the old app's client-only page
  (`app/src/pages/LinkRedirect.vue`), which only resolved after the JS
  bundle loaded and used a client-side `router.replace()` — a crawler or a
  WhatsApp link-preview bot never saw a real redirect there. This file
  registers an explicit h3/Nitro route (matched before Nuxt's page-render
  catch-all — no Vue page needed, every outcome is a redirect or a static
  message), looks up `links/{code}` via the plain client Firestore SDK
  (public `get` by exact doc ID already allowed in `firestore.rules`, no
  Admin SDK needed), and:
  - Not found, or `active === false` → renders the same inline "Este link
    no es válido o ya no está activo." message with a link to
    `/departamentos` (not a redirect) that the old page showed, now as a
    real server-rendered `noindex` HTML response (`X-Robots-Tag: noindex`
    header, since this response never goes through Nuxt's head
    management) instead of a client-hydrated one.
  - `propertyType: 'rental'` + `propertyId` → 301 to
    `/departamentos/{propertyId}?ref={code}`.
  - `propertyType: 'sale'` + `propertyId` → 301 to
    `/ventas/{propertyId}?ref={code}`.
  - No usable `propertyType`/`propertyId` → 301 to `/departamentos?ref={code}`.
  - Deliberately preserved, not "fixed": the `es` locale is hardcoded on
    every redirect target regardless of visitor language (matches
    `@nuxtjs/i18n`'s `prefix_except_default` scheme, where `es` is
    unprefixed at the root), and the `?ref=<code>` query param is still
    appended for lead-capture attribution
    (`app/src/composables/useLeadCapture.ts` reads `route.query.ref`, with
    a `localStorage` fallback) even though neither Nuxt detail page reads
    it yet — N1 deliberately deferred porting that UI. This milestone only
    guarantees the param survives the redirect for whenever that lands.
  - New shared helper `nuxt-app/server/utils/serverFirestore.ts`
    (`getServerFirestore()`) factors out the "dedicated named Firebase
    app, plain client SDK" pattern N1's `server/api/__sitemap__/urls.ts`
    already established for bare Nitro routes that run outside the Vue
    render pipeline (where `nuxt-vuefire`'s Vue-plugin-driven app init
    can't be assumed to have already run) — `urls.ts` itself left
    untouched, just reusing the same idea for this new route.
- **Legacy `?id=` query-param redirects folded into Nuxt server routes**
  (`nuxt-app/server/routes/departamento.html.get.ts` and
  `detalle-venta.html.get.ts`): ports `app/functions/src/index.ts`'s
  `legacyDetailRedirect`/`legacyVentaDetailRedirect` Cloud Functions
  1:1 — same `?id=` contract, same missing/invalid-id fallback to the bare
  `/departamentos`/`/ventas` root — but redirecting same-origin
  (`/departamentos/{id}`, `/ventas/{id}`) instead of to the old
  `OLD_SITE_ORIGIN` (`https://www.bairesrental.com.ar`), since Nuxt itself
  is now the live site and there's no separate "old site" to send visitors
  to. **`legacyDetailRedirect`/`legacyVentaDetailRedirect` themselves are
  deliberately left deployed and untouched in `app/functions/src/
  index.ts`** — deleting them is N5's job (the M8 rebuild-automation
  teardown), not this milestone's; this only builds the Nuxt-side
  equivalent that the old app's Hosting rewrites (`/departamento.html` →
  `legacyDetailRedirect`, etc.) pointed at.
- **Plain old→new URL redirects ported into `nuxt-app/firebase.json`**:
  added the exact same `hosting.redirects` array from `app/firebase.json`
  (index.html → /, departamentos.html → /departamentos, ventas.html →
  /ventas, tickets.html → /tickets, catalogo-vendedores.html → /app/login,
  ficha-vendedor.html → /app/login), alongside the existing catch-all
  `rewrites` entry. Confirmed Firebase Hosting evaluates `redirects`
  before `rewrites` as assumed — all 6 came back as real Hosting-level
  301s (plain-text body, no `nuxtSsr` involvement) rather than reaching
  the Nuxt function at all (see verification below).
  - The old app's `/l/**` → `/index.html` and `/app/**` → `/app/login.html`
    SPA-fallback Hosting rewrites were deliberately **not** ported — both
    are obsolete by construction now that `/l/:code` has its own real
    server route (above) and `/app/*` already has real server-enforced
    auth middleware from N2/N3, reached via the existing catch-all
    `"source": "**"` rewrite to `nuxtSsr`.

### Verification (real commands/output, against a real deployed preview channel — not just local dev)

1. **Local dev** (`npm run dev`): all 5 `/l/:code` cases (rental, sale,
   no-propertyId, inactive, nonexistent) against 4 real disposable test
   `links/{code}` docs created via the Admin SDK
   (`n4test-rental`/`n4test-sale`/`n4test-nopid`/`n4test-inactive`,
   pointing at real existing `Baires`/`lafinur-3000` listings, all deleted
   immediately after this check) — all 5 redirected/rendered exactly as
   specified. Both `departamento.html?id=` and `detalle-venta.html?id=`
   (with and without `id`) 301ed correctly. (The 6 static `redirects`
   can't be checked in local dev — they're a Hosting-layer feature, not
   something `nuxt dev` serves — confirmed only against the deployed
   channel, step 4 below.)
2. **`npm run build`** — succeeded first try; build output lists the 3 new
   route chunks (`departamento.html.get.mjs`, `detalle-venta.html.get.mjs`,
   `l/_code_.get.mjs`) alongside the existing ones; `firebase-functions`
   still `^6.6.0`/`6.6.0` in both `package.json` and
   `.output/server/package.json` (N0–N3 gotcha #1 not reproduced).
3. **N0 gotcha #2 re-applied**: `rm -rf node_modules && npm install
   --omit=dev` inside `.output/server` before deploying (still required).
4. **`firebase functions:list` before and after `firebase deploy --only
   functions:nuxtssr`** — identical both times: all 9 pre-existing
   functions (`createTrackableLink`, `legacyDetailRedirect`,
   `legacyVentaDetailRedirect`, `onRentalWrite`, `onSaleWrite`,
   `setUserRole`, `submitLead`, `uploadListingImage`, `onUserCreate`)
   present and unchanged, plus `nuxtSsr` (updated, as expected). Deploy
   succeeded (`https://nuxtssr-jeho2yf6nq-rj.a.run.app`).
5. **`firebase hosting:channel:deploy n4-l-redirects`** →
   `https://bairesrental--n4-l-redirects-ofgedtjd.web.app` (expires
   2026-09-20). Repeated every check against this **real deployed
   channel**, including the 6 static redirects that local dev can't serve:
   ```
   GET /index.html                → 301, location: /                (plain-text body, Hosting-level — no nuxtSsr)
   GET /departamentos.html        → 301, location: /departamentos
   GET /ventas.html               → 301, location: /ventas
   GET /tickets.html              → 301, location: /tickets
   GET /catalogo-vendedores.html  → 301, location: /app/login
   GET /ficha-vendedor.html       → 301, location: /app/login

   GET /departamento.html?id=Baires        → 301, location: /departamentos/Baires   (real HTML body from nuxtSsr, not plain-text)
   GET /departamento.html                  → 301, location: /departamentos
   GET /detalle-venta.html?id=lafinur-3000 → 301, location: /ventas/lafinur-3000
   GET /detalle-venta.html                 → 301, location: /ventas
   ```
   For `/l/:code`, created 4 fresh disposable test docs against the real
   project (`n4dep-rental`, `n4dep-sale`, `n4dep-nopid`, `n4dep-inactive`),
   confirmed each against the deployed channel, then deleted all 4
   (confirmed gone via a separate follow-up read):
   ```
   GET /l/n4dep-rental          → 301, location: /departamentos/Baires?ref=n4dep-rental
   GET /l/n4dep-sale            → 301, location: /ventas/lafinur-3000?ref=n4dep-sale
   GET /l/n4dep-nopid           → 301, location: /departamentos?ref=n4dep-nopid
   GET /l/n4dep-inactive        → 200, x-robots-tag: noindex, "Este link no es válido o ya no está activo."
   GET /l/n4dep-doesnotexist    → 200, x-robots-tag: noindex, same message (nonexistent code)
   ```
6. **Live site + 9 functions confirmed untouched**: `firebase
   functions:list` diff (step 4) showed no drift; `curl
   https://bairesrental.web.app/` still `200`s with `<html lang="es">`
   (no `dir`) and `logo-perfin-redes.png` — the old Vue app's exact
   fingerprint, same check N1–N3 used, confirming `hosting:channel:deploy`
   never touched the live release.

### Notes for whoever picks up N5

- `legacyDetailRedirect`/`legacyVentaDetailRedirect` (and the Hosting
  rewrites in `app/firebase.json` pointing at them) are now fully
  superseded by this milestone's Nuxt-side equivalents, but were
  deliberately left alone here — deleting them, along with the rest of the
  M8 rebuild-automation subsystem (`onRentalWrite`/`onSaleWrite`/
  `scheduledRebuildCheck`, the GitHub Actions workflow, the `GITHUB_PAT`
  requirement), is N5's explicit scope.
- No new gotchas beyond N0–N3's (firebase-functions pin, `.output/server`
  prune workaround, one-`curl`-per-tool-call for external URLs, prefer
  fresh disposable Firestore docs/users over touching shared fixtures) —
  this milestone didn't hit a new one.

## N4-prep — Four home-page bugs from live preview QA

The user tested N3's deployed preview channel and reported 4 home-page
bugs. All 4 were real, root-caused with actual evidence (not guessed),
fixed, and reverified locally and on a fresh deployed preview channel.

- **Bug 1 — fonts looked "weird" (fake-bold)**: `nuxt.config.ts`'s Google
  Fonts `<link>` for DM Sans requested weights up to 700 only
  (`...0,9..40,700;1,9..40,400`), but the page CSS uses `font-weight: 800`
  extensively (`.hero-title`, `.stat-num`, `.plan-precio`, etc.) — the
  browser was synthesizing (fake-bolding) 800 from the 700 file instead of
  downloading the real one. The original static site's own link
  (`bairesrental/index.html` line 50) already requests 800 — added it to
  the Nuxt link's non-italic axis, matching. Verified: the Google Fonts
  CSS response now contains a real `font-weight: 800` `@font-face` block,
  and the `.stat-num`/etc. divs render crisp (screenshotted, no
  blur/doubling) on both local dev and the new preview channel.
  - Found and deliberately did **not** fix a separate, pre-existing,
    unrelated font issue while investigating this: `.hero-title` (and
    every other `<h1>`–`<h6>` on the page) actually renders in a serif
    font ("Roboto Slab"), not DM Sans at all — caused by a global,
    un-scoped `h1, h2, h3, h4, h5, h6 { font-family: "Roboto Slab", serif;
    }` rule in `css/style.css` (line 111), which wins over the inherited
    `font-family: 'DM Sans'` set on the page's root `.br-home` wrapper
    (an explicit rule on an element always beats an inherited one,
    regardless of specificity). Confirmed this is **not** a Nuxt
    regression — a headless-Chrome screenshot of the live production old
    Vue app (`bairesrental.web.app`) shows the exact same serif hero
    title. Out of scope for this milestone (not one of the 4 reported
    bugs, predates the migration, and "fixing" the shared global `h1`
    rule would touch every heading site-wide) — flagged here for whoever
    picks it up next.
- **Bug 2 — "Nuestras propiedades" section missing from home**: the
  original static site's `#propiedades` section (a static 7-image
  gallery + "Ver catálogo completo →" CTA, between the hero/stats and
  "Por qué" sections) never made it into either the M7 Vue port or the
  Nuxt port. Brought it back as a **real featured-listings section**
  instead of static images, since this is now real SSR with live
  Firestore trivially available: `app/pages/index.vue` now fetches
  `rentals` via `useCollection` (same composable/client-SDK/public-read-rule
  approach `app/pages/departamentos/index.vue` already uses for the public
  catalog — not a new pattern), filters to `disponibilidad === 'disponible'`,
  sorts `esPropio` listings first, and shows the first 6 as cards reusing
  the catalog's own card CSS classes (`.br-prop-card`, `.br-prop-img`,
  `.br-badge*`, etc. — all live in the shared, global `public/css/style.css`,
  not scoped to the departamentos page, so reusing them needed no new CSS)
  linking to `/departamentos/[id]`, plus a "Ver catálogo completo" CTA to
  `/departamentos`. Added `home.propiedades.{label,title,btn}` to both
  `i18n/locales/es.json` (copied from the original static site's
  `p-label`/`p-title`/`p-btn` strings) and `en.json` (translated).
  Verified: real Firestore-backed cards with real photos/prices/badges
  render between `#stats` and `#por-que` in both locales, locally and on
  the new preview channel.
- **Bug 3 — reviews marquee "broken a little bit"**: found the real
  defect by rendering the page in a real (headless, but real-engine)
  Chrome and inspecting the `#reviews` section, not by guessing from the
  vague report. The review cards showed only 1–2 words per line with a
  huge blank gap before the reviewer's name — **not** the
  `reviewsRow1`/`reviewsRow2` split (that's even: 16 reviews ÷ 2 = 8/8,
  ruled out first) and **not** the `-webkit-line-clamp` truncation recipe
  either (ruled out second, the hard way: overriding
  `display`/`-webkit-line-clamp`/`-webkit-box-orient`/even `width` itself
  — via an injected stylesheet **and** a direct
  `el.style.setProperty('width','200px','important')` — never changed the
  element's computed width, which stayed exactly 320px regardless).
  Root cause, found by walking every matched `CSSStyleSheet` rule
  (including ones nested inside `@media` blocks, which a naive
  `[...sheet.cssRules]` scan silently skips): `public/css/style.css`
  still carries a **leftover rule from the pre-M7 "fh5co" template**
  (recognizable by its `#fh5co-hero`/`.fh5co-heading` neighbors),
  `@media (min-width: 1150px) { .review-text { padding-inline: 10rem; }
  }` — 160px of padding on *each* side, inside a 300px-wide card, at
  desktop widths. The M7 marketing redesign reused the generic class name
  `.review-text` for the new marquee cards without knowing it collided
  with this old, unrelated rule; Vue's scoped `data-v-*` styles don't
  protect against a plain, un-scoped, same-named global selector still
  matching the element. This also explains why it only reproduced at
  wide (>=1150px) viewports. Fixed by renaming the class to
  `.review-quote` in `app/pages/index.vue` (template + scoped style) —
  sidesteps the collision without touching the shared, legacy
  stylesheet, which may still serve its original (unknown, unrelated)
  purpose elsewhere. Reverified with a fresh page load (the live
  DOM-patching used to diagnose it doesn't reliably reproduce a real
  fix — retested from a clean navigation each time): cards now show full
  3-line wrapped text at normal width, in both locales, locally and on
  the new preview channel.
  - Also checked, while in there: no `-webkit-line-clamp`/marquee-specific
    hydration mismatch in the console. There **is** a pre-existing,
    unrelated hydration warning ("Hydration text content mismatch on
    li") for the `home.planes.plan{1,2,3}Items` lists (`tm()` returning a
    compiled-message AST during SSR vs. a resolved array on the client) —
    21 warnings, matching the 6+8+7 total `<li>` count across the three
    plans exactly. Not touched: unrelated to any of the 4 reported bugs,
    predates this milestone, and `home.planes` wasn't part of this
    brief — flagged here for whoever picks it up next.
- **Bug 4 — "can't make it translate in Spanish"**: real bug, and root
  cause was the opposite of what it looked like — not a translation
  failure, a **redirect** fighting the manual switcher. `@nuxtjs/i18n`'s
  browser-language auto-detection is **on by default**
  (`redirectOn: 'root'`, `useCookie: true`) and `nuxt.config.ts` never
  overrode it. Proved this with a real headless-*browser* navigation
  (not `curl` — curl sends no `Accept-Language` header, so it never
  reproduced this): the very first load of `/` landed on `/en` with
  `document.cookie` already carrying `i18n_redirected=en`, purely because
  the browser's default `Accept-Language` is English. Worse, the nav's
  ES/EN toggle (`app/layouts/default.vue`) is a plain `<a :href>`, not a
  `switchLocalePath`-aware navigation that also updates that cookie, so a
  full-page click back to `/` hit the *same* server-side auto-redirect
  again on the next load — from an English-locale browser, the site
  could never actually be made to stay in Spanish, exactly matching the
  report. Confirmed this reproduces on both local dev and the (pre-fix)
  N3 preview channel alike — not a deploy-only quirk. Fixed by setting
  `i18n.detectBrowserLanguage: false` in `nuxt.config.ts`: this site
  already ships an explicit manual switcher, so auto-detection only
  fights it, and bouncing this Argentina-based business's own visitors to
  English ahead of its `es` default (which the N1 canonical/hreflang/
  sitemap work is already built around) is the wrong default regardless
  of the switcher bug. Reverified with the exact same real-browser
  script: fresh load of `/` now stays on `/` (`es-AR`, no cookie), one
  click reaches `/en` (`en-US`), a second click returns to `/` (`es-AR`)
  — on both local dev and the new deployed preview channel.

### Verification

1. **Local dev** (`npm run dev`) — all 4 fixes checked with real,
   evidence-based methods, not eyeballing: `curl` + grep for real
   rendered strings in both locales; a real (not curl-simulated) headless
   Chrome driven over the DevTools Protocol (CDP) for anything that
   depends on actual browser behavior — font rendering, computed
   CSS/layout, cookies, and multi-step click navigation — since `curl`
   can't exercise any of those. `npm run build` succeeded first try;
   `firebase-functions` still `^6.6.0` in both `package.json` and
   `.output/server/package.json` (N0–N3 gotcha #1 not reproduced).
2. **N0 gotcha #2 re-applied**: `npm install --omit=dev` inside
   `.output/server` before deploying (still required).
3. **`firebase functions:list` before and after `firebase deploy --only
   functions:nuxtssr`** — identical both times: all 9 pre-existing
   functions present and unchanged, plus `nuxtSsr` (updated, as
   expected). Deploy succeeded
   (`https://nuxtssr-jeho2yf6nq-rj.a.run.app`).
4. **`firebase hosting:channel:deploy n4-homefixes`** →
   `https://bairesrental--n4-homefixes-qx49g3mt.web.app` (expires
   2026-09-20). Repeated every check from all 4 bugs above against this
   real deployed channel — identical results to local dev, including the
   real-browser auto-detect-redirect and locale-toggle click test.
5. **Live site confirmed untouched**: `curl https://bairesrental.web.app/`
   still `200`s with `<html lang="es">` (no `dir` attribute) and
   `logo-perfin-redes.png` — the old Vue app's exact fingerprint, same
   check N1–N3 used, confirming `hosting:channel:deploy` never touched
   the live release.

### Real gotcha hit this milestone (new, not from N0–N3)

`chrome --headless=new --screenshot` (Chrome's simple one-shot CLI
screenshot flag) turned out to be unreliable for anything beyond "screenshot
the top of the page": (a) navigating to a URL with a `#fragment` produced a
blank white image every time, with no error — silently broken, not just
slow; (b) asking for a tall `--window-size` to capture more of a long page
works only up to some internal limit (~8192 physical pixels found by
bisection) — beyond it the output silently tiles/repeats earlier content
instead of erroring. Neither is a Nuxt or app bug, both are quirks of that
one-shot CLI flag. Fix: drive Chrome for real over the DevTools Protocol
instead (`--remote-debugging-port`, open a target via `PUT /json/new`,
`Page.navigate` + wait for `Page.loadEventFired`, `Runtime.evaluate` to
`scrollIntoView` a specific section, then `Page.captureScreenshot`) — this
is also what made the real click-through locale-toggle test and the live
computed-style inspection for Bug 3 possible at all, neither of which a
one-shot screenshot or plain `curl` could ever have caught. Worth reusing
this approach directly for any future milestone that needs to verify real
browser behavior (not just raw SSR HTML).

Running log of the Vue+vite-ssg → Nuxt 3/4 real-SSR rewrite (see
`~/.claude/plans/declarative-swimming-backus.md` for the approved plan and
why: the old `app/` build-time-only prerendering needed a whole
rebuild-automation subsystem — Firestore triggers → scheduled check →
GitHub Actions → a GitHub PAT — just to keep listings fresh; real
per-request SSR removes that entirely). Newest entries at the top. Records
what was actually built/verified and what broke along the way, matching
`app/CHANGELOG.md`'s style — not a design doc, that's the plan file.

## N3 — Admin/seller/owner app pages (authenticated CRUD)

Ported the authenticated CRUD app (`app/src/pages/app/**`) into
`nuxt-app/app/pages/app/**`. These pages were confirmed (via an earlier
Explore-agent SSR-safety survey, plus this milestone's own read-through)
to have no SEO/crawler reason to be server-rendered with real data — all
`noindex`, all behind auth — so, per this milestone's brief, they stayed
**client-side fetch-on-mount**, same as the old vite-ssg app, rather than
being converted to server-rendered data-fetching. The one real
architectural change from the old app: Firestore/Functions access no
longer creates a second Firebase app singleton
(`app/src/firebase/client.ts`'s `getFirebaseApp()`) — everything now
sources the app instance from `nuxt-vuefire`'s canonical one via
`useFirebaseApp()`/`useFirestore()` (both from `vuefire`).

- **New shared utils** (`nuxt-app/app/utils/`, auto-imported everywhere):
  - `adminCrud.ts` — `listAll`/`listBySeller`/`listByOwner`/`getOne`/
    `saveOne`/`removeOne`, ported 1:1 from `app/src/data/adminCrud.ts`,
    sourced from `useFirestore()` instead of the old singleton. Confirmed
    safe to call from anywhere (including deep inside an `onMounted`
    callback after an `await`, which is exactly how every list/form page
    uses them) by reading `vuefire`'s own source
    (`node_modules/vuefire/dist/shared/vuefire.*.mjs`): `useFirestore()` →
    `useFirebaseApp()` falls back to plain `getApp()` (a global singleton,
    no Vue component-instance dependency) whenever there's no active Vue
    instance to inject from — not guessed, read before relying on it.
  - `storageUpload.ts` — `uploadPropertyImage()`, ported from
    `app/src/data/storageUpload.ts`'s base64-encode-then-call pattern
    against the **existing, unchanged** `uploadListingImage` callable,
    sourcing the Functions instance via `useFirebaseApp()` imported
    explicitly from `#imports` (Nuxt's virtual auto-import module) rather
    than relying on the auto-import transform inside a plain `.ts` file —
    same pattern `nuxt-vuefire`'s own runtime composables use internally.
  - `userRole.ts` — `fetchUserRole()`, a plain async function (not a
    reactive composable) reading role off ID token custom claims, same
    source as `app/middleware/auth.ts`. Deliberately not a
    composable-with-its-own-`onMounted`: two independent `onMounted` hooks
    run in registration order but aren't awaited against each other, so
    RentalForm/SaleForm — which need the role resolved *before* deciding
    whether to prefill `sellerUid` on a new listing — call this inline in
    their own `onMounted` instead of racing a separate one.
- **New layout** `nuxt-app/app/layouts/app-shell.vue`, ported from
  `app/src/layouts/AppShellLayout.vue` — the nav chrome for every
  authenticated `/app/*` page, role-aware links, logout button. Every new
  page below uses `layout: 'app-shell'` (N2's `login.vue` stays
  `layout: false` — not gated, must render for anyone).
- **Pages ported**, all under `definePageMeta({ layout: 'app-shell',
  middleware: 'auth', requiresAuth: true, allowedRoles: [...] })` matching
  the old router's exact `meta.allowedRoles` per route:
  - `app/admin/rentals.vue` (`/app/admin/rentals`, `admin`) — list + search.
  - `app/admin/sales.vue` (`/app/admin/sales`, `admin`) — list + search.
  - `app/admin/users.vue` (`/app/admin/users`, `admin`) — role assignment
    via the existing, unchanged `setUserRole` callable.
  - `app/rentals/[id].vue` / `app/sales/[id].vue` (`/app/rentals/:id`,
    `/app/sales/:id`, `admin`+`seller`) — shared admin+seller create/edit
    forms, `id === 'new'` for creation (old convention preserved). Image
    upload via `storageUpload.ts`.
  - `app/seller/listings.vue` (`/app/seller/listings`, `seller`) — own
    listings via `listBySeller()`.
  - `app/seller/links.vue` (`/app/seller/links`, `seller`) — trackable-link
    generator via the existing, unchanged `createTrackableLink` callable,
    plus a raw inline Firestore query on `links` filtered by `sellerUid`
    (not through `adminCrud.ts`, matching the old file exactly).
  - `app/seller/leads.vue` (`/app/seller/leads`, `seller`) — CRM view, raw
    inline query on `leads` filtered by `sellerUid`, sorted
    **client-side** (not Firestore `orderBy`) — kept exactly as the old
    file did it, to avoid needing a composite index.
  - `app/owner/index.vue` (`/app/owner`, `owner`) — read-only,
    `ownerUid`-filtered queries on both `rentals` and `sales`.
  - `app/dashboard.vue` updated: the real `ROLE_HOME` redirect (admin →
    `/app/admin/rentals`, seller → `/app/seller/listings`, owner →
    `/app/owner`) that N2 deferred is now in, via `await navigateTo(...)`
    at the top level of `<script setup>` — confirmed (by reading
    `node_modules/nuxt/dist/app/composables/router.js`) that this produces
    a real **server-side** redirect even outside route middleware: on the
    server, `navigateTo()` sets `nuxtApp.ssrContext["~renderResponse"]`
    directly rather than only working when `return`ed, so an admin/seller/
    owner hitting `/app/dashboard` directly gets redirected before the
    placeholder markup ever renders — a small improvement over the old
    Vue Router app, which could only do this client-side.
  - `app/admin-test.vue` (N2's throwaway wrong-role-redirect placeholder)
    **deleted** — real admin pages now prove that path.

### Verification (real commands/output against the real `bairesrental` project — no shared test accounts used)

1. **Server-side auth enforcement, local** (`npm run dev`): all 9 new
   protected routes (`/app/admin/rentals`, `/app/admin/sales`,
   `/app/admin/users`, `/app/rentals/new`, `/app/sales/new`,
   `/app/seller/listings`, `/app/seller/links`, `/app/seller/leads`,
   `/app/owner`) return `302` to `/app/login?redirect=<path>` with **no**
   protected content in the body (`curl` confirmed a bare refresh-shell,
   same shape as N2) when hit with no cookie.
2. **Real functional round-trip** — script using `firebase-admin` (to
   create/delete disposable test users) + the real client `firebase` SDK
   (to exercise the exact same Firestore/Functions calls the UI code
   does), run against the live project:
   - Created 4 disposable users (`n3-verify-admin-temp`,
     `n3-verify-roletarget-temp`, `n3-verify-seller-a-temp`,
     `n3-verify-seller-b-temp`), all `@bairesrental.com.ar`, all deleted at
     the end — **never** touched the shared `test-admin`/`test-seller`
     accounts (same restriction N2 hit and worked around the same way).
   - **Role assignment**: signed in as the disposable admin, called the
     real `setUserRole` callable against the disposable role-target user,
     then re-fetched via Admin SDK and confirmed
     `customClaims.role === 'seller'`. PASS.
   - **Rental CRUD + image upload**: created a real rental doc
     (`n3-verify-rental-temp`) via `setDoc` (same call `saveOne()` makes),
     confirmed it appears in a `getDocs(rentals)` listing, edited its
     `titulo` and confirmed the edit persisted, uploaded a real 1×1 PNG via
     the `uploadListingImage` callable and confirmed the returned Storage
     URL was publicly fetchable (`200`, `content-type: image/png`), then
     deleted the doc and confirmed it was gone. All PASS.
   - **Sale CRUD + image upload**: identical round-trip for
     `n3-verify-sale-temp` (including its own `uploadListingImage` call
     with a different `collectionName`/path pattern). All PASS.
   - **Seller-scoped isolation**: created one rental, one trackable link
     (via the real `createTrackableLink` callable), and one lead per
     disposable seller (A and B). Confirmed seller B's own
     `sellerUid`-filtered queries on `rentals`/`links`/`leads` returned
     only seller B's own docs. Then, for the two collections where
     `firestore.rules` actually enforces this (`links`, `leads` — `rentals`
     is intentionally public-read, so isolation there is a UI-filtering
     concern, not a security one), **attempted** to query seller A's data
     as seller B (`where('sellerUid', '==', <seller A's uid>)`) and
     confirmed it was rejected with `permission-denied` — a real negative/
     rejection-case proof, not just "the happy path returned the right
     rows." All 5 isolation checks PASS.
   - **Cleanup confirmed independently**: after the script's own cleanup
     ran (14/14 checks passed; 2 non-fatal cleanup-task errors were just
     redundant deletes of already-deleted docs made from a signed-out
     client, harmless), a separate follow-up script queried the real
     project directly via the Admin SDK and confirmed: all 4 disposable
     Auth users gone, all 6 disposable Firestore docs gone, 0 leftover
     `links` docs for either disposable seller, 0 leftover `users/` docs,
     and both uploaded test Storage objects
     (`rentals/n3-verify-rental-temp/cover.png`,
     `sales/n3-verify-sale-temp/1.png`) gone.
3. **`npm run build`** — succeeded first try; `firebase-functions` still
   `^6.6.0` in both `package.json` and `.output/server/package.json`
   (checked before deploying — N0/N1/N2 gotcha #1 not reproduced). All new
   route chunks present in the build output (`rentals-*`, `sales-*`,
   `users-*`, `listings-*`, `links-*`, `leads-*`, `owner-*`,
   `app-shell-*`, updated `dashboard-*`).
4. **N0 gotcha #2 re-applied**: `npm install --omit=dev` inside
   `.output/server` before deploying (still required).
5. **`firebase functions:list` before and after `firebase deploy --only
   functions:nuxtssr`** — identical both times: all 9 pre-existing
   functions (`createTrackableLink`, `legacyDetailRedirect`,
   `legacyVentaDetailRedirect`, `onRentalWrite`, `onSaleWrite`,
   `setUserRole`, `submitLead`, `uploadListingImage`, `onUserCreate`)
   present and unchanged, plus `nuxtSsr` (updated, as expected). Deploy
   succeeded (`https://nuxtssr-jeho2yf6nq-rj.a.run.app`).
6. **`firebase hosting:channel:deploy n3-app`** →
   `https://bairesrental--n3-app-10yrvxmh.web.app` (expires 2026-09-20).
   Repeated check 1 (all 9 routes, unauthenticated → `302` to login, no
   protected content) against this **real deployed preview channel** —
   identical results.
   - Also repeated N2's full authenticated-SSR proof against this deployed
     channel with a fifth disposable user
     (`n3-verify-deployed-temp@bairesrental.com.ar`, `admin`, deleted after
     the check): real `signInWithPassword` REST call → real ID token →
     `POST /api/__session` → `201` with a `Set-Cookie: __session=...` →
     `GET /app/admin/rentals` with that cookie → `200` with the real
     `Alquileres (…)` heading in the raw HTML (not the login page) —
     proof the deployed function's session-cookie verification and the
     `auth` middleware's `allowedRoles` check both work end-to-end against
     the real deployed preview, not just locally.
7. **Live site + 9 functions confirmed untouched (again, post-deploy)**:
   `firebase functions:list` diff (step 5) showed no drift; `curl
   https://bairesrental.web.app/` still `200`s with `<html lang="es">` and
   `logo-perfin-redes.png` — the old Vue app's exact fingerprint, same
   check N1/N2 used, confirming `hosting:channel:deploy` never touched the
   live release.

### Real notes for whoever picks up N4

- No new gotchas beyond N0/N1/N2's three (firebase-functions pin,
  `.output/server` prune workaround, one-`curl`-per-tool-call for external
  URLs) — this milestone didn't hit a new one.
- `rentals`/`sales` are intentionally public-read in `firestore.rules`
  (that's the whole public catalog), so "seller-scoped isolation" for
  those two collections is enforced by the UI's `sellerUid` query filter,
  not by security rules — don't mistake the isolation check on those two
  for a security boundary the way it genuinely is on `links`/`leads`.
- `AppShellLayout`'s nav (and RentalForm/SaleForm's `isAdmin` computed) all
  resolve role via a plain `onMounted` + `fetchUserRole()`, which means a
  brief flash of role-less nav on first paint before hydration resolves it
  — acceptable for an internal, `noindex` tool per this milestone's brief,
  but worth knowing if it's ever visible enough to bother someone.

## N2 — Real server-enforced auth via session cookies

Made auth real: the old app's guard (`app/src/main.ts`'s `router.beforeEach`)
explicitly skipped auth during prerendering (`if (to.meta.requiresAuth &&
!import.meta.env.SSR)`) and only redirected after the client JS bundle
hydrated. This milestone replaces it with `nuxt-vuefire`'s session-cookie
feature plus a universal (server **and** client) Nuxt route middleware, so
an unauthenticated request for a protected page is redirected by the server
before any protected content is ever sent — proven with plain `curl`, no
browser, both locally and against a real deployed preview channel.

- **`nuxt.config.ts`**: added `vuefire.auth = { enabled: true, sessionCookie:
  true }`. Confirmed against `node_modules/nuxt-vuefire/dist/module.mjs`
  (not guessed from docs) exactly how the service account is supplied: the
  module checks `process.env.GOOGLE_APPLICATION_CREDENTIALS` **at `nuxt
  dev`/`nuxt build` time** (inside its `setup()`) to decide whether to wire
  in the session-cookie server route (`/api/__session`) and the
  cookie-minting client plugin at all — there's no separate "admin config
  object" for the key. If the env var is a relative path, the module
  resolves it against `nuxt.options.rootDir` itself.
  - `.env` (gitignored) now sets `GOOGLE_APPLICATION_CREDENTIALS=../app/serviceAccountKey.json`
    — reuses the existing key, satisfies the build-time check for local dev.
    **This is deliberately not carried into the deployed Cloud Function** —
    nothing bundles it there, so at runtime the Admin SDK falls back to
    Application Default Credentials via the function's own runtime identity
    (`654252544387-compute@developer.gserviceaccount.com`, confirmed via
    `gcloud functions describe nuxtSsr --gen2`). That fallback is exactly
    why the IAM grant below was needed — without a local private key, admin
    SDK's `createSessionCookie`/`createCustomToken` sign via the IAM
    Credentials API's `signBlob`, which requires the calling identity to be
    allowed to impersonate itself.
- **One-time IAM grant, done via `gcloud`, confirmed successful**:
  - IAM Service Account Credentials API (`iamcredentials.googleapis.com`)
    was **already enabled** on `bairesrental` (checked first via `gcloud
    services list --enabled`, not assumed).
  - Granted `roles/iam.serviceAccountTokenCreator` to
    `654252544387-compute@developer.gserviceaccount.com` **on itself**:
    ```
    gcloud iam service-accounts add-iam-policy-binding \
      654252544387-compute@developer.gserviceaccount.com \
      --project=bairesrental \
      --member="serviceAccount:654252544387-compute@developer.gserviceaccount.com" \
      --role="roles/iam.serviceAccountTokenCreator"
    ```
    Confirmed via `get-iam-policy` immediately after (previously empty
    except for the response `etag`). This SA already carried
    `roles/firebaseauth.admin`/`roles/datastore.user` project-wide from
    M4–M8, so no other grant was needed. Real proof this specific grant is
    what mattered: minting a session cookie against the **deployed**
    preview channel succeeded (`POST /api/__session` → `201`) — before this
    grant that call would have failed, since the deployed function has no
    private key to sign with locally.
- **`app/middleware/auth.ts`** (new, universal — no `.client`/`.server`
  suffix): calls `getCurrentUser()` (auto-imported by `nuxt-vuefire`,
  confirmed working both server- and client-side, not just client-side as
  the brief flagged for verification). Not signed in → `navigateTo('/app/login',
  { query: { redirect: to.fullPath } })`. Signed in but role not in
  `to.meta.allowedRoles` → `navigateTo('/app/dashboard')`. Role is read via
  `user.getIdTokenResult(true)` off the **ID token custom claims** — same
  source as the old `app/src/stores/auth.ts`, never a Firestore doc read.
  Applied per-page via `definePageMeta({ middleware: 'auth', requiresAuth:
  true, allowedRoles: [...] })`, carrying over the old route `meta`
  concept — `PageMeta` has an index signature (`[key: string]: unknown`),
  confirmed in `node_modules/nuxt/dist/pages/runtime/composables.d.ts`, so
  no type augmentation was needed for the custom fields.
- **Pages** (all `layout: false` — `AppShellLayout` doesn't exist yet,
  that's N3 scope, and the marketing `default.vue` layout doesn't belong on
  an internal tool page):
  - `app/pages/app/login.vue` — ported from `app/src/pages/app/Login.vue`.
    Email/password via `signInWithEmailAndPassword` against
    `useFirebaseAuth()`. No `requiresAuth` (must render for anyone); a
    `watchEffect` on `useCurrentUser()` bounces an already-signed-in visitor
    onward, working server-side too (unlike the old `onMounted`-only
    check). Confirmed the cookie actually gets minted on login exactly as
    `nuxt-vuefire`'s docs claim, not assumed: `nuxt-vuefire`'s own
    `auth/plugin-mint-cookie.client` posts the fresh ID token to
    `/api/__session` on `onIdTokenChanged`, which responds `201` with
    `Set-Cookie: __session=...` (see verification below).
  - `app/pages/app/dashboard.vue` — ported from
    `app/src/pages/app/Dashboard.vue`, minus the real `ROLE_HOME` redirect
    (N3 scope, since `admin`/`seller`/`owner` areas don't exist yet).
    Gated with `middleware: 'auth', requiresAuth: true` (no `allowedRoles`
    — any signed-in role, or none yet, may land here). Shows "Signed in as
    `<email>`, role: `<role>`" — the page this milestone's whole
    verification hinges on. Includes a logout button (`signOut(auth)`,
    which triggers `onIdTokenChanged(null)` → the same client plugin POSTs
    an empty token to `/api/__session`, which responds `204` and clears the
    cookie — confirmed directly with `curl`, see below).
  - `app/pages/app/admin-test.vue` — placeholder-only, exists solely to
    prove the wrong-role redirect path (`allowedRoles: ['admin']`); not a
    real admin page, safe to delete once N3 lands real admin routes.

### Verification (real commands, real output — both local and deployed)

**Test identities**: two pre-existing test users already existed in the
real project's Firebase Auth (`test-admin-2@bairesrental.com.ar` /admin,
`test-seller@bairesrental.com.ar` /seller, from earlier `app/` milestones —
found via `listUsers()`), but changing an existing shared account's
password to test with was refused by this session's own safety
classifier ("Modify Shared Resources") — correctly, since these are shared
project state, not scratch fixtures. Followed the brief's documented
fallback instead: created two **new**, disposable test users via the
Admin SDK (`n2-verify-temp@bairesrental.com.ar` role `admin`,
`n2-verify-seller-temp@bairesrental.com.ar` role `seller`), used them for
every check below, then **deleted both** (`auth.deleteUser`) once
verification finished — nothing test-related was left in the project.

1. **Unauthenticated server-side redirect, local** — the single most
   important check in this milestone:
   ```
   curl -i http://localhost:3000/app/dashboard
   → HTTP/1.1 302 Found
     location: /app/login?redirect=/app/dashboard
     <!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/app/login?redirect=/app/dashboard"></head></html>
   ```
   A real HTTP redirect with a bare refresh-shell body — no dashboard
   markup, no user data, nothing protected in the response at all.
2. **Real login → real session cookie → real authenticated SSR, local**:
   got a real ID token via the Identity Toolkit REST API
   (`signInWithPassword`, the same call the client SDK makes), POSTed it to
   the app's own session endpoint, then curled the dashboard with the
   resulting cookie:
   ```
   curl -s -X POST http://localhost:3000/api/__session -d '{"token":"<idToken>"}'
   → HTTP/1.1 201 Created
     set-cookie: __session=<JWT>; Max-Age=432000000; Path=/; HttpOnly; Secure; SameSite=Lax

   curl -i --cookie "__session=<value>" http://localhost:3000/app/dashboard
   → HTTP/1.1 200 OK
     ...<h1 class="h4 mb-3">Panel</h1><p>Sesión iniciada como n2-verify-temp@bairesrental.com.ar</p><p>Rol: <strong>admin</strong></p>...
   ```
   Real server-rendered HTML with the signed-in user's actual email and
   role baked into the raw response — not a client-hydrated shell.
3. **Wrong-role redirect, local**: signed in as the `seller` test user,
   confirmed their own dashboard renders (`Rol: <strong>seller</strong>`),
   then hit the admin-only placeholder:
   ```
   curl -i --cookie "__session=<seller cookie>" http://localhost:3000/app/admin-test
   → HTTP/1.1 302 Found
     location: /app/dashboard
   ```
4. **Logout clears the cookie**: `curl -X POST /api/__session -d '{}'` (no
   token) → `HTTP/1.1 204 No Content`, `set-cookie: __session=; Max-Age=0;
   Path=/` — matches `api.session-verification.js`'s delete-cookie branch.
5. **`npm run build`** — succeeded first try; `firebase-functions` still
   `^6.6.0` in both `package.json` and `.output/server/package.json`
   (checked before deploying, N0/N1 gotcha #1 not reproduced). Both new
   auth-only chunks (`login-*.mjs`, `dashboard-*.mjs`, `admin-test-*.mjs`,
   `auth-*.mjs`) present in the build output alongside the existing pages.
6. **N0 gotcha #2 re-applied**: `npm install --omit=dev` inside
   `.output/server` before deploying (still required).
7. **`firebase functions:list` before and after `firebase deploy --only
   functions:nuxtssr`** — identical both times: all 9 pre-existing
   functions unchanged, plus `nuxtSsr` (updated). Deploy succeeded
   (`https://nuxtssr-jeho2yf6nq-rj.a.run.app`).
8. **`firebase hosting:channel:deploy n2-auth`** → `https://bairesrental--n2-auth-yb3ej2yj.web.app`
   (expires 2026-09-20). Repeated checks 1–2 against this **real deployed
   URL**, same rigor as N0/N1:
   ```
   curl -i https://bairesrental--n2-auth-yb3ej2yj.web.app/app/dashboard
   → HTTP/2 302, location: /app/login?redirect=/app/dashboard, no protected content

   curl -X POST https://bairesrental--n2-auth-yb3ej2yj.web.app/api/__session -d '{"token":"<idToken>"}'
   → HTTP/2 201, set-cookie: __session=<JWT>

   curl --cookie "__session=<value>" https://bairesrental--n2-auth-yb3ej2yj.web.app/app/dashboard
   → HTTP/2 200, body contains "n2-verify-temp@bairesrental.com.ar" and "Rol: <strong>admin</strong>"
   ```
   The `201` on the deployed `/api/__session` call is the direct proof the
   IAM self-grant is what made this work in production — the deployed
   function has no private key file, so that call only succeeds by
   impersonating itself via the IAM Credentials API.
9. **Live site + 9 functions confirmed untouched**: `firebase
   functions:list` diff (step 7) showed no drift; `curl
   https://bairesrental.web.app/` still returns `<html lang="es">` and
   `<link rel="icon" href="/images/logo-perfin-redes.png">` — the old Vue
   app's exact markup (same fingerprint N1 used), confirming
   `hosting:channel:deploy` never touched the live release.

### Real gotcha hit this milestone (new, not from N0/N1)

Attempting to set a known password on an **existing** Firebase Auth test
user (via `auth.updateUser(uid, { password })`) to script a login test was
blocked by this session's own auto-mode permission classifier
("Modify Shared Resources") — a legitimate guardrail, since that account is
shared project state from earlier milestones, not a disposable fixture.
Worked around it exactly as the brief anticipated: created brand-new,
disposable test users via the Admin SDK instead of mutating existing ones,
and deleted them after verification. Worth knowing for N3, which will need
real multi-role manual QA: prefer creating fresh throwaway accounts for
scripted verification over resetting existing ones, even when the existing
ones look like obvious test fixtures.

## N1 — Public catalog + detail pages + i18n + sitemap

Ported the public-facing pages from `app/src/pages/` into
`nuxt-app/app/pages/`, replacing vite-ssg's build-time-only rendering with
real per-request SSR via `nuxt-vuefire`'s `useCollection`/`useDocument`
against live Firestore data. All of it verified against the real
`bairesrental` project, both locally and on a real Hosting preview
channel — not just "it built."

- **i18n via `@nuxtjs/i18n@10.6.0`** — replaced the old app's hand-rolled
  `routeName()`/`LOCALES`/`localePrefix()` (`app/src/router/index.ts`) and
  `useLocaleLinks.ts` with the module's built-in `prefix_except_default`
  strategy (`es` unprefixed at root, `en` under `/en/...`, matching the old
  scheme exactly) and its built-in SEO composables. Locale files ported
  verbatim from `app/src/i18n/locales/{es,en}.json` (all keys, including
  `leadCapture`/`app` even though those aren't used by any page yet — no
  reason to split the file) into `nuxt-app/i18n/locales/{es,en}.json` — the
  module's default `restructureDir: 'i18n'` + `langDir: 'locales'`
  (relative to the Nuxt **root**, not `srcDir`/`app/`), confirmed by
  reading `node_modules/@nuxtjs/i18n/dist/module.mjs`'s actual defaults
  rather than guessing.
  - `nuxt.config.ts` sets `i18n.baseUrl: 'https://www.bairesrental.com.ar'`
    — required for `useLocaleHead()` to emit **absolute** canonical/
    hreflang URLs; without it the module only warns and emits nothing
    useful. Confirmed by reading `runtime/routing/head.js` before setting
    it, not by trial and error.
  - Every page's canonical + hreflang alternates now come for free from a
    single `useHead(useLocaleHead({ seo: true }))` call in
    `app/layouts/default.vue`, instead of the old per-page
    `useLocaleLinks()` call building a `link` array by hand on every
    single page. One real behavior difference worth knowing: the module
    also auto-emits `og:locale`/`og:locale:alternate`/`og:url` meta tags as
    part of `seo: true` — not present in the old app, harmless, and
    arguably a small SEO improvement, not something added on purpose.
- **Layout**: `app/src/layouts/SiteLayout.vue` (426 lines) ported to
  `nuxt-app/app/layouts/default.vue` near-verbatim — same nav/drawer/
  footer markup and scoped styles, same `window`/`document` usage
  confined to `onMounted`/`onUnmounted`/`watch`. The only structural
  change: `routeName()`/`useLocaleLinks()` calls replaced by
  `useLocalePath()`/`useSwitchLocalePath()`, and the old router's explicit
  `meta.baseName` nav-active-link check replaced by stripping
  `@nuxtjs/i18n`'s `___<locale>` route-name suffix
  (`String(route.name).split('___')[0]`) — Nuxt's file-based routing names
  pages after their file path, so there's no equivalent to hand-set
  `meta.baseName` anymore.
- **Pages ported**: Home (`app/pages/index.vue` — full M7 marketing
  content: hero, animated stats, plans, income calculator, testimonials,
  reviews marquee, award section, Web3Forms contact form, single
  `RealEstateAgent` JSON-LD block, dedup preserved and reverified — see
  Verification below), Departamentos (`app/pages/departamentos/index.vue`),
  DepartamentoDetail (`app/pages/departamentos/[id].vue`), Ventas
  (`app/pages/ventas/index.vue`), VentaDetail (`app/pages/ventas/[id].vue`),
  Tickets (`app/pages/tickets.vue`). `getAllRentals()`/`getRental(id)`/
  `getAllSales()`/`getSale(id)` (`app/src/data/properties.ts`'s SSR-admin-
  SDK/client-SDK fetch split) are gone entirely — every page now calls
  `useCollection`/`useDocument` straight against `rentals`/`sales` with the
  plain client Firestore SDK, the same composables confirmed working for
  real per-request SSR in N0's spike page, now proven again across 6 real
  pages × 2 locales.
  - **Lead-capture-before-WhatsApp deliberately NOT ported** on either
    detail page, per this milestone's brief — `app/src/composables/
    useLeadCapture.ts`'s `localStorage` guard is only *accidentally*
    SSR-safe under vite-ssg (a thrown `ReferenceError` happens to get
    swallowed by a bare `try/catch`, not something to rely on under real
    Nuxt SSR). Both detail pages show a plain WhatsApp link with a
    one-line comment noting the deferral; this is real lost functionality
    vs. the old app (visitors arriving via a seller's tracked `/l/:code`
    link won't get the name+phone capture form yet) until N2/N3 port
    auth + leads properly.
  - Filter logic on Departamentos/Ventas ported as-is, **not** extended —
    per `app/README.md`, the old app itself never had full filter parity
    with the original static site (no amenity-checkbox/mascotas/URL-
    query-param sync), and that gap is unchanged here, not newly
    introduced.
  - Per-page `useHead`/JSON-LD now uses Nuxt's built-in `useSeoMeta` (title/
    description/OG as reactive getters keyed off the `useDocument` ref) +
    a plain `useHead({ script: [...] })` for JSON-LD, instead of importing
    `@unhead/vue` directly like the old app needed to.
- **Sitemap via `@nuxtjs/sitemap@8.5.1`** (newly installed) replaces
  `app/scripts/generate-sitemap.js`'s postbuild-only script. Static pages
  (home/departamentos/ventas/tickets) need no explicit listing — the
  module discovers them automatically from the page files. Only the
  per-listing dynamic routes need a runtime source:
  `nuxt-app/server/api/__sitemap__/urls.ts` queries `rentals`/`sales` via
  the plain client Firestore SDK (not Admin SDK — see deviation note
  below) and returns `{ loc: '/departamentos/<id>' }`/
  `{ loc: '/ventas/<id>' }` entries; `nuxt.config.ts`'s
  `sitemap.sources: ['/api/__sitemap__/urls']` wires it in.
  `autoI18n` (auto-enabled once it detects `@nuxtjs/i18n`) then expands
  every URL into a per-locale `sitemapindex` (`/sitemap.xml` →
  `/__sitemap__/es-AR.xml` + `/__sitemap__/en-US.xml`) with `xhtml:link`
  hreflang alternates on every single `<url>` — verified for real (see
  below), matching and slightly exceeding the old script's hand-rolled
  `localizedEntries()` output.
  - **Real deviation from the brief, worth flagging**: the brief suggested
    querying Firestore "via the Admin SDK" for the sitemap source. Did
    **not** do that — `nuxt-vuefire`'s `admin` option isn't configured in
    this app yet (that's N2 scope, alongside the session-cookie IAM setup
    the plan already calls out), so there's no service-account credential
    wired into the Nitro runtime to use. Used the plain Firestore client
    SDK instead, via a dedicated named app (`initializeApp(config,
    'sitemap-source')`) rather than depending on `nuxt-vuefire`'s own
    Vue-plugin-driven app init (which this bare API route, outside the Vue
    render pipeline, can't assume has already run). `firestore.rules`
    already allows public reads on `rentals`/`sales` — the same access the
    public catalog pages themselves rely on — so this needed no new
    permissions. Revisit once N2 wires up the Admin SDK for session
    cookies, if there's ever a reason to prefer it here (there isn't a
    strong one — public data, public read rule).
  - `nuxt-app/public/robots.txt` updated to point at `/sitemap.xml` and
    disallow `/app/` (not built yet — N3 scope — but matches the old
    app's robots.txt and the plan's route layout, so nothing needs
    touching here again once those routes exist).
- **Static assets copied from `app/public/`**: `css/style.css`,
  `css/pricing.css` (reused as-is, per this repo's CLAUDE.md — never
  touch the vendor CSS, only `css/style.css` itself, which stays
  untouched here since it's copied verbatim, not edited), `fonts/icomoon/*`,
  and the two logo images the layout/head actually reference
  (`bairesrentallogoblanco.png`, `logo-perfin-redes.png`). Google Fonts
  preconnect + DM Sans `<link>`, the Bootstrap 5.3 CDN `<link>`, and the
  two local stylesheet `<link>`s moved into `nuxt.config.ts`'s `app.head`
  (there's no per-app `index.html` to hand-edit under Nuxt, unlike the old
  `app/index.html`).

### Verification (real commands, real output)

1. **Local dev, no JS** (`npm run dev`, `curl` against
   `localhost:3000`) — real IDs pulled via the Admin SDK against the live
   project (`Baires` — a rental, confirmed already known-real from N0's
   spike; `lafinur-3000` — a sale). Confirmed for **all** of
   `/departamentos`, `/en/departamentos`, `/departamentos/Baires`,
   `/en/departamentos/Baires`, `/ventas`, `/en/ventas`,
   `/ventas/lafinur-3000`, `/en/ventas/lafinur-3000` (plus home and
   tickets in both locales): 200 status, real per-page `<title>`,
   `<meta name="description">`, `<link rel="canonical">` pointing at
   `https://www.bairesrental.com.ar/...`, 5 `hreflang` alternates
   (`es`, `es-AR`, `en`, `en-US`, `x-default`), and exactly one
   `application/ld+json` block per detail page (`Apartment`/
   `RealEstateListing`) with real price/address/description baked in —
   all confirmed in the raw HTML via a Python head-parse, not just eyeballed
   grep (an early plain-grep pass falsely looked like description/JSON-LD
   were missing on detail pages — turned out to be grep failing on
   multi-line attribute values from the emoji-heavy listing descriptions,
   not an actual bug; re-checked with a proper HTML-aware parse before
   concluding anything).
   - Home page: confirmed exactly one `RealEstateAgent` JSON-LD block
     (`grep -c` → 1), nav/footer/logo present in the raw response.
   - 404 case: `/departamentos/no-existe-este-id` → 200 with
     `<title>Propiedad no encontrada — BairesRental</title>` and
     `<meta name="robots" content="noindex">`, matching the old app's
     not-found behavior.
   - `/sitemap.xml` → 307 redirect to `/sitemap_index.xml` (autoI18n
     splitting per locale) → 92 URLs in `__sitemap__/es-AR.xml` (4 static
     + 85 rentals + 3 sales — the same 85/3 counts as `app/CHANGELOG.md`'s
     M7 entry), each with `xhtml:link` hreflang alternates.
2. **`npm run build`** — succeeded first try, no firebase-functions
   version drift (still pinned `^6.6.0`, confirmed via `grep` on
   `package.json` before and after `npm install @nuxtjs/sitemap`), no
   other build errors. One pre-existing, harmless Vite warning about a
   798 KB client chunk — not addressed, out of scope for this milestone.
3. **Both N0 gotcha workarounds re-applied and still needed**: confirmed
   `firebase-functions` still `^6.6.0` in `package.json` before deploying,
   then `npm install --omit=dev` inside `.output/server` (still required —
   skipping it would reproduce N0's missing
   `firebase-functions/lib/v2/index.js` failure during `firebase-tools`'
   static-analysis step).
4. **`firebase functions:list` before and after
   `firebase deploy --only functions:nuxtssr`** — identical both times:
   all 9 pre-existing functions (`createTrackableLink`,
   `legacyDetailRedirect`, `legacyVentaDetailRedirect`, `onRentalWrite`,
   `onSaleWrite`, `setUserRole`, `submitLead`, `uploadListingImage`,
   `onUserCreate`) present and unchanged, plus `nuxtSsr` (updated, as
   expected). Deploy itself succeeded
   (`https://nuxtssr-jeho2yf6nq-rj.a.run.app`).
5. **`firebase hosting:channel:deploy n1-catalog`** — deployed to
   `https://bairesrental--n1-catalog-xol4t7dp.web.app` (expires
   2026-09-20). Repeated the exact same `curl` + head-parse checks from
   step 1 against this **real preview channel URL** — identical results,
   including canonical URLs correctly resolving to
   `https://www.bairesrental.com.ar/...` (the configured `site.url`/
   `i18n.baseUrl`) even though served from the `.web.app` preview host.
   Also spot-checked static assets over the real CDN path: `css/style.css`,
   `css/pricing.css`, the logo PNG, `fonts/icomoon/icomoon.woff`, and
   `robots.txt` all 200.
6. **Confirmed the live site untouched**: `curl
   https://bairesrental.web.app/` still returns the **old** Vue app's HTML
   shell (`lang="es"` with no `dir`, `favicon` at
   `/images/logo-perfin-redes.png`, old script-tag structure) — visibly
   different markup from the new Nuxt app's `lang="es-AR" dir="ltr"` +
   `/favicon.ico`, confirming `hosting:channel:deploy` never touched the
   live release channel.

### Real gotcha hit this milestone (new, not from N0)

A `for` loop issuing several `curl` calls to the real `*.web.app` preview
URL in a single Bash invocation intermittently failed with `command not
found: curl` (while `which curl` and a single bare `curl` call to the same
host worked fine seconds later, and `curl` to `localhost` inside a loop
had worked earlier in the same session). Root cause not fully isolated —
most likely a session-local sandboxing quirk around this session's
network-egress allowance for external hosts specifically inside a
multi-command loop construct, not a real problem with `curl` or the
deployed app. **Workaround**: issued each external `curl` as its own
separate Bash tool call instead of inside a `for` loop — worked
reliably every time. Worth knowing for whoever runs N2's verification:
prefer one `curl` per tool call for **external** URLs; loops seem fine
for `localhost`.

## N0 — Nuxt 4 scaffold + nuxt-vuefire + one-page deploy spike (recap)

Not documented in a CHANGELOG at the time it was done — recapped here
from the state of `nuxt-app/` at the start of N1, so the log has a
complete history for whoever picks up N2.

- Nuxt 4 scaffold in `nuxt-app/` (sibling to `app/`, per the plan — build
  and verify independently, cut over only once confirmed working).
  `nuxt-vuefire` wired to the real `bairesrental` Firebase project via
  `NUXT_PUBLIC_FIREBASE_*` env vars.
- Deploy pipeline: Nitro's `firebase` preset (`nitro.preset: 'firebase'`,
  gen2, `southamerica-east1`, `serverFunctionName: 'nuxtSsr'`) +
  `firebase.json`'s **isolated `"codebase": "nuxtssr"`** — deliberately
  separate from the old app's `"default"` codebase (9 unrelated functions
  live there) so `firebase deploy --only functions:nuxtssr` can never
  touch them.
  - `firebase.json`'s hosting config points at `.output/public` with a
    catch-all rewrite to the `nuxtSsr` function — same site
    (`bairesrental`) as the live old app, reached only via explicit
    `hosting:channel:deploy` for anything other than the untouched live
    release.
- A minimal spike page (`app/pages/index.vue` at the time, since replaced
  by N1's real Home page) called `useDocument` against a real
  `rentals/Baires` doc and rendered its `titulo`/`barrio`/`precio`/
  `descripcion` — verified via `curl` with no JS that real Firestore
  content came back in the raw HTML response, through the actual Firebase
  Hosting rewrite (not just the direct Cloud Run function URL), proving
  real per-request SSR end-to-end before building anything else on top.
- **Two real gotchas found and fixed, still relevant for every future
  deploy from this app**:
  1. `npm install` in `nuxt-app/` pulls `firebase-functions@7.x` by
     default, but the installed `firebase-tools` CLI can't parse that
     version's module layout and deploy fails with a cryptic "unexpected
     error." Pinned to `^6.6.0` in `package.json` — must not drift back to
     v7 on a future `npm install`.
  2. Nitro's `firebase` preset prunes `.output/server`'s `node_modules`
     down to only what it traces as runtime-needed, which breaks
     `firebase-tools`' own separate static-analysis step during deploy
     (missing `firebase-functions/lib/v2/index.js`). Fix: run
     `npm install --omit=dev` inside `.output/server` before every
     `firebase deploy --only functions:nuxtssr` — applied again in N1
     before its deploy (not re-tested by skipping it; no reason to
     believe the underlying pruning behavior changed since N0).
