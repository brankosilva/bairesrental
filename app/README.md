# BairesRental — Vue + Firebase app (in progress)

This replaces the static HTML site (still at the repo root) with a Vue 3 SPA
prerendered at build time (`vite-ssg`, no server at request time) backed by
Firebase (Auth, Firestore, Storage, Functions, Hosting). See the approved
migration plan for the full picture — ask whoever's driving the migration
for `~/.claude/plans/declarative-swimming-backus.md`, or check `docs/` at
the repo root for the current site's business/data context.

**Status: M0–M8 done.** See `CHANGELOG.md` for what was actually
built/tested in each milestone, including gotchas — there are a few real
ones worth reading before touching Firebase config on this project again
(IAM grants this org doesn't auto-provide, a confirmed-broken
Storage↔Firestore cross-service rules feature that changed the seller
image-upload architecture, M7's Web3Forms finding: their free plan
rejects server-to-server calls entirely, so the contact form's Web3Forms
call stays client-side by design — that's not an oversight — and M8's
finding that `firebase deploy`'s function-discovery step evaluates the
*whole* codebase up front, so a function referencing a not-yet-created
secret blocks deploying anything else in the same file too, not just
itself).

The old→new URL redirect map (M8) is live: `firebase.json`'s `redirects`
send the old static pages to their new SPA routes, and two Cloud
Functions (`legacyDetailRedirect`, `legacyVentaDetailRedirect`) handle the
two query-param detail pages Hosting's redirect matching can't see
(`?id=`). The rebuild-on-data-change pipeline is half-live: the Firestore
triggers that mark `meta/lastPropertyChange` are deployed and verified;
the scheduled function that actually dispatches a GitHub Actions
build+deploy (`scheduledRebuildCheck`) and the workflow it triggers
(`.github/workflows/rebuild-and-deploy.yml`) are written and typecheck
cleanly but need two credentials only a human can create — see
`CHANGELOG.md`'s M8 entry for the exact commands.

Live: home (full marketing content — stats, plans, calculator,
testimonials, reviews, contact form), `/departamentos` +
`/departamentos/:id`, `/ventas` + `/ventas/:id`, `/tickets` — in **es
(unprefixed) and en (`/en/...`)**, reading real Firestore data,
prerendered with per-page SEO + hreflang, plus a generated `sitemap.xml`
(via the `postbuild` script) that `robots.txt` already points at. Full
Auth + role-based access (admin/seller/owner) via custom claims. The
admin app (`/app/admin/*` — rentals/sales CRUD, user role assignment),
the seller dashboard (`/app/seller/*` — self-service listings,
trackable-link generator, leads/CRM), and the owner's read-only status
view (`/app/owner`) are all built and working — plus the
lead-capture-before-WhatsApp flow on the public listing pages when a
visitor arrives via a seller's tracked link (`/l/:code`). All of it
verified against the real project, including negative/rejection cases,
not just the happy path.

The home page's contact form calls Web3Forms directly from the browser,
same as the original static site — a server-side `submitContactForm`
Cloud Function was built and deployed for this, but a real end-to-end
test against the live function proved Web3Forms' free plan rejects
server-to-server calls outright (confirmed independently with a plain
`curl`, not just from the function). That function has been removed; see
`CHANGELOG.md`'s M7 entry for the full story and what real server-side
email delivery would actually require if it's ever wanted.

Not yet built: **M9** — migrating the catalog-maintenance scripts/skills
(`scripts/add-from-tokko.js`, `add-from-tencery.js`, `add-property.js`,
`add-property-venta.js`, `check-ficha-links.js`,
`fix-share-google-urls.js`, plus the `agregar-depto`/`agregar-depto-venta`
skills) from the root `data/*.json` files to Firestore; and **M10** —
staging QA + the actual DNS cutover (pointing `www.bairesrental.com.ar` at
this Firebase project instead of GitHub Pages, after which M8's redirect
map starts mattering for real traffic).

## First-time setup

1. **Create the Firebase project** (needs your Google account — not
   something an agent can do for you): go to
   [console.firebase.google.com](https://console.firebase.google.com/),
   create a project, and enable **Authentication**, **Firestore**, and
   **Storage** in the console (Functions gets added in a later milestone).
2. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`,
   then `firebase login`.
3. Inside this `app/` folder, run `firebase use --add` and select the
   project you just created — this generates `.firebaserc` (gitignored is
   NOT needed for this file, it's fine to commit once you have a real
   project id, but it doesn't exist yet in this scaffold).
4. `npm install`.
5. Copy `.env.example` to `.env.local` and fill in the values from
   **Project settings → General → Your apps → SDK setup and config** in the
   Firebase console (create a Web app there first if you haven't).

## Running the emulators

```
npm run emulators
```

Starts Auth/Firestore/Storage emulators + the Emulator UI (default
http://localhost:4000). Always develop and test against this — never
against production data. **Requires a local Java runtime** (the
Firestore/Storage emulators run on the JVM) — install one (e.g. `brew
install openjdk`) if `firebase emulators:start` fails with "Unable to
locate a Java Runtime."

Once the real project exists, also sanity-check the rules files compile
before relying on them: `firebase deploy --only firestore:rules,storage --dry-run`.

## Running the M1 data migration

Moves `data/departamentos.json` / `data/ventas.json` (repo root) and their
images into Firestore + Storage. See the header comment in
`scripts/migrate-to-firestore.js` for exactly what it does and doesn't
migrate (short version: sales photo galleries move fully to Storage;
rentals keep their external ficha.info/Google Photos gallery link and only
the cover photo moves to Storage).

**Always run against the emulator first:**

```
FIREBASE_PROJECT_ID=<your-project-id> \
FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com \
npm run migrate:emulator -- --yes
```

(the `migrate:emulator` script already sets `FIRESTORE_EMULATOR_HOST` /
`FIREBASE_STORAGE_EMULATOR_HOST` for you — you only need to provide the
project id and bucket name env vars above it).

Without `--yes` it just prints what it would do (dry-run) — do this first.
Check the Emulator UI to spot-check a handful of documents and that image
URLs actually resolve before doing anything against the real project.

**Only once the emulator run looks correct**, run it for real:

```
FIREBASE_PROJECT_ID=<your-project-id> \
FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com \
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
npm run migrate:prod -- --yes
```

(download a service-account key from **Project settings → Service
accounts → Generate new private key** — keep it out of git, it's already
covered by `.gitignore`). This asks for an interactive "yes" confirmation
before touching the real project even with `--yes` passed, since there's no
emulator safety net on this path.

The original JSON files and images stay in the repo (not deleted) as a
fallback — this migration is additive, not destructive, to the git history.

## Local development

```
npm run dev
```

Plain Vite dev server with hot reload — reads Firestore via the client SDK
config in `.env.local` (the `import.meta.env.SSR` branch in
`src/data/properties.ts` never triggers in dev, only during `build`), so
you're always looking at live data. No prerendering here; use `build` to
check the SEO output.

## Building the prerendered site

```
npm run build
```

Runs `vite-ssg build`, which needs `GOOGLE_APPLICATION_CREDENTIALS` set (or
`app/serviceAccountKey.json` present locally — `vite.config.ts` falls back
to it automatically) to enumerate every rental/sale ID from Firestore into
a concrete route (`vite.config.ts`'s `includedRoutes`). Inspect the
generated files afterwards — e.g. `grep -o '<title>[^<]*</title>' dist/departamentos/<some-id>.html`
— to confirm per-listing title/description/OG/canonical/JSON-LD are baked
into the static HTML, not just injected after JavaScript runs. That's the
mechanism the whole SEO strategy depends on (verified in M2 — see
`CHANGELOG.md`).

npm automatically runs `postbuild` right after (`scripts/generate-sitemap.js`
— same credentials fallback as above), producing `dist/sitemap.xml` from
the same live Firestore data plus every static public page. Check its
console output (`sitemap.xml generado con N URLs...`) or just
`grep -c '<url>' dist/sitemap.xml` to confirm the count looks right —
roughly `(static pages + rentals + sales) × 2 locales`.
