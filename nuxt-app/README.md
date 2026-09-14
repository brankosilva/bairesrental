# BairesRental — Nuxt 3/4 SSR rewrite (in progress)

Replaces `app/` (Vue 3 + `vite-ssg`, build-time-only prerendering) with a
Nuxt 4 app doing real per-request SSR against Firebase, via
[`nuxt-vuefire`](https://vuefire.vuejs.org/nuxt/). See the approved
migration plan for the full picture — ask whoever's driving the migration
for `~/.claude/plans/declarative-swimming-backus.md`. Deployed independently
of `app/` (a different Firebase Functions codebase, `"nuxtssr"`, and only
ever reachable via a Hosting preview channel so far) — `app/` stays the
live site at `bairesrental.web.app` until an explicit, human-approved
cutover.

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

- The same Firebase project (`bairesrental`) runs **9 other Cloud
  Functions** deployed from `app/functions` under the `"default"`
  codebase — completely unrelated to this app. `firebase.json` here uses
  an isolated `"codebase": "nuxtssr"` specifically so this app's deploys
  can never touch them. Always deploy scoped: `firebase deploy --only
  functions:nuxtssr`, never a bare `firebase deploy`.
- For Hosting, only ever use `firebase hosting:channel:deploy
  <channel-name>` — never `firebase deploy --only hosting`, which would
  overwrite the live release currently serving the old Vue app at
  `bairesrental.web.app`.
- Before **and** after any functions deploy, run `firebase functions:list`
  and confirm the 9 unrelated functions are unchanged.

## First-time setup

1. `npm install` inside `nuxt-app/` (keeps `firebase-functions` pinned to
   `^6.6.0` — see `CHANGELOG.md`'s N0 entry for why letting it drift to
   `^7.x` breaks deploys).
2. Copy the Firebase Web SDK config into `.env` (see `.env`'s existing
   keys — `NUXT_PUBLIC_FIREBASE_*`, same values as `app/.env.local`).

## Local development

```
npm run dev
```

Reads live Firestore data via `nuxt-vuefire`'s client SDK — there's no
prerendering step to remember to re-run, unlike `app/`. Use `curl` (not a
browser) against a page to confirm SEO tags are actually server-rendered:

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
firebase functions:list   # confirm the 9 unrelated functions are untouched
firebase hosting:channel:deploy <some-channel-name>
```
