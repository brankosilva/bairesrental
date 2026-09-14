# BairesRental — Nuxt 4 SSR app

The live app at `bairesrental.web.app`: a Nuxt 4 app doing real
per-request SSR against Firebase, via
[`nuxt-vuefire`](https://vuefire.vuejs.org/nuxt/). It replaced an earlier
Vue 3 + `vite-ssg` build-time-prerendered rewrite that lived in `app/` at
the repo root; that folder has since been deleted, and its Cloud
Functions (`functions/`), Firestore/Storage rules and its changelog
(`docs/historial-app-vue.md`) were moved here. The original static HTML
site still serves `www.bairesrental.com.ar` from the repo root via GitHub
Pages — the DNS cutover is a separate, not-yet-taken step.

**Status: N0–N1 done.** See `CHANGELOG.md` for what was actually built and
verified in each milestone, including real gotchas (a `firebase-functions`
version pin that must not drift, a `.output/server` `node_modules`-pruning
issue that needs a workaround before every functions deploy).

Live (on the `n1-catalog` Hosting preview channel, not yet the production
domain): home (full marketing content), `/departamentos` +
`/departamentos/:id`, `/ventas` + `/ventas/:id`, `/tickets` — in **es
(unprefixed) and en (`/en/...`)** via `@nuxtjs/i18n`, reading real
Firestore data on every request (not prerendered), with per-page SEO
(title/description/OG/canonical/hreflang/JSON-LD) and a dynamic
`sitemap.xml` via `@nuxtjs/sitemap`. Listing detail pages show a plain
WhatsApp contact link — lead-capture-before-WhatsApp is deferred to a
later milestone (see `CHANGELOG.md`'s N1 entry for why). No auth, no
admin/seller/owner app yet (N2/N3).

## Critical safety notes before touching Firebase config here

- This folder now owns **two separate Functions codebases** in the
  `bairesrental` project: `"nuxtssr"` (the SSR handler, built from
  `.output/server` by `npm run build`) and `"default"` (the 9 callable /
  trigger functions in `functions/` — `setUserRole`, `inviteUser`,
  `createTrackableLink`, `submitLead`, `uploadListingImage`,
  `onUserCreate`, plus the two legacy `?id=` redirect functions). Always
  deploy scoped to the one you changed (`firebase deploy --only
  functions:nuxtssr` or `--only functions:default`), never a bare
  `firebase deploy`.
- `firebase deploy --only hosting` here publishes the live release at
  `bairesrental.web.app` — use `firebase hosting:channel:deploy
  <channel-name>` for anything you want to check first.
- Before **and** after any functions deploy, run `firebase functions:list`
  and confirm the codebase you weren't deploying is unchanged.
- `firestore.rules`, `firestore.indexes.json` and `storage.rules` live
  here now and are the only copies — `firebase deploy --only
  firestore,storage` publishes them.

## First-time setup

1. `npm install` inside `nuxt-app/` (keeps `firebase-functions` pinned to
   `^6.6.0` — see `CHANGELOG.md`'s N0 entry for why letting it drift to
   `^7.x` breaks deploys).
2. Copy the Firebase Web SDK config into `.env` (see `.env`'s existing
   keys — `NUXT_PUBLIC_FIREBASE_*`), plus
   `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json` pointing at
   the gitignored Admin SDK key in this folder (needed at `nuxt dev` /
   `nuxt build` time for the session-cookie server route, and by
   `functions/scripts/bootstrap-admin.js`).

## Local development

```
npm run dev
```

Reads live Firestore data via `nuxt-vuefire`'s client SDK — there's no
prerendering step to remember to re-run. Use `curl` (not a browser)
against a page to confirm SEO tags are actually server-rendered:

```
curl -s http://localhost:3000/departamentos/<a-real-id> | grep -o '<title>[^<]*</title>'
```

## Building + deploying

```
npm run build
```

Then, **before every functions deploy** (Nitro's `firebase` preset prunes
`.output/server`'s `node_modules` in a way that breaks `firebase-tools`'
own deploy-time static analysis otherwise):

```
cd .output/server && npm install --omit=dev && cd ../..
firebase deploy --only functions:nuxtssr
firebase functions:list   # confirm the "default" codebase is untouched
firebase deploy --only hosting            # publishes the live release
# ...or, to check it first: firebase hosting:channel:deploy <channel-name>
```

To deploy the callable/trigger functions instead (they build via the
`predeploy` hook in `firebase.json`):

```
firebase deploy --only functions:default
```
