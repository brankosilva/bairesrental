#!/usr/bin/env node
// M7: generates dist/sitemap.xml from live Firestore data at build time,
// wired in as npm's "postbuild" hook (see package.json — npm runs
// "postbuild" automatically right after the "build" script finishes).
// public/robots.txt already points at https://www.bairesrental.com.ar/sitemap.xml
// — this is what actually produces that file; there was no hand-written
// sitemap in this app before (unlike the legacy static site's committed
// sitemap.xml at the repo root, which goes stale as the catalog changes).
//
// Static pages are hardcoded below rather than imported from
// src/router/index.ts's `pages` array: that file isn't exported, and more
// importantly this script runs as plain Node ESM (no TS loader) after the
// build, so it can't import a .ts module directly. This mirrors the same
// choice vite.config.ts already made for its own includedRoutes hook (it
// also doesn't import router/index.ts — it independently queries Firestore
// and builds `/departamentos/${id}` paths by hand). Keep STATIC_PAGES,
// LOCALES and localePrefix() below in sync with src/router/index.ts if
// that file's `pages` array or locale scheme ever changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');
const SITE_URL = 'https://www.bairesrental.com.ar';

// Base paths (no leading/trailing slash) for every static public page —
// matches the `path` values in src/router/index.ts's `pages` array (home,
// departamentos, ventas, tickets). Excludes the dynamic app/* admin-seller-
// owner routes (noindex'd via robots.txt) and /l/:code (not prerendered —
// see app/CHANGELOG.md M5+M6 on why).
const STATIC_PAGES = ['', 'departamentos', 'ventas', 'tickets'];

const LOCALES = ['es', 'en'];
const DEFAULT_LOCALE = 'es';

function localePrefix(locale) {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

function pagePath(locale, basePath) {
  const prefix = localePrefix(locale);
  return basePath ? `${prefix}/${basePath}` : prefix || '/';
}

function urlEntry(loc, alternates) {
  const altLinks = alternates
    ? alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${SITE_URL}${a.href}" />`).join('\n')
    : '';
  return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n${altLinks ? altLinks + '\n' : ''}  </url>`;
}

// Builds one <url> entry per locale for a given set of same-page paths,
// each carrying hreflang alternates pointing at its sibling locale (plus
// x-default) — a small bonus over plain <loc>-only entries.
function localizedEntries(pathsByLocale) {
  const alternates = [
    ...LOCALES.map((l) => ({ hreflang: l, href: pathsByLocale[l] })),
    { hreflang: 'x-default', href: pathsByLocale[DEFAULT_LOCALE] },
  ];
  return LOCALES.map((l) => urlEntry(pathsByLocale[l], alternates));
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const localKey = path.join(APP_ROOT, 'serviceAccountKey.json');
    if (fs.existsSync(localKey)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = localKey;
    }
  }

  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps().length ? getApps()[0] : initializeApp();
  const db = getFirestore(app);

  const [rentals, sales] = await Promise.all([
    db.collection('rentals').select().get(),
    db.collection('sales').select().get(),
  ]);

  const entries = [];

  for (const basePath of STATIC_PAGES) {
    entries.push(...localizedEntries(Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, basePath)]))));
  }

  for (const doc of rentals.docs) {
    entries.push(...localizedEntries(Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, `departamentos/${doc.id}`)]))));
  }

  for (const doc of sales.docs) {
    entries.push(...localizedEntries(Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, `ventas/${doc.id}`)]))));
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join('\n') +
    `\n</urlset>\n`;

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`No existe ${DIST_DIR} — corré "npm run build" primero (este script está pensado como postbuild).`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml);
  console.log(
    `sitemap.xml generado con ${entries.length} URLs (${STATIC_PAGES.length} páginas estáticas + ${rentals.docs.length} alquileres + ${sales.docs.length} ventas, × ${LOCALES.length} idiomas).`,
  );
}

main().catch((err) => {
  console.error('Error generando sitemap.xml:', err);
  process.exit(1);
});
