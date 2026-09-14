#!/usr/bin/env node
// One-off migration (plan milestone M1): moves data/departamentos.json and
// data/ventas.json into Firestore, and their images into Firebase Storage.
//
// Per the approved plan:
//   - rentals: only the single cover `imagen` is uploaded to Storage
//     (rentals/{id}/cover.<ext>). `fotos` (an external ficha.info/Google
//     Photos link today) is left untouched — rentals have no in-app
//     gallery feature to preserve, unlike sales.
//   - sales: the full `fotos[]` gallery (already local, up to 20 photos)
//     is uploaded to Storage (sales/{id}/{n}.<ext>) and the array rewritten
//     to the resulting download URLs.
//   - both gain ownerUid/sellerUid (null — today's listings are all
//     BairesRental's own) and createdAt/updatedAt server timestamps.
//
// Usage:
//   npm run migrate:emulator              (dry-run against the local emulators)
//   npm run migrate:emulator -- --yes     (actually write, still local)
//   npm run migrate:prod                  (dry-run against the REAL project)
//   npm run migrate:prod -- --yes         (writes to the REAL project — asks
//                                          for interactive confirmation first,
//                                          even with --yes, since there's no
//                                          FIRESTORE_EMULATOR_HOST safety net)
//
// Flags:
//   --yes            actually write (Firestore + Storage). Without it, this
//                    only prints what it would do.
//   --skip-images    don't touch Storage at all; useful for iterating on the
//                    Firestore document shape without re-uploading 95MB of
//                    images every run.
//   --only-rentals / --only-sales   migrate just one collection.
//
// Required env vars (see app/.env.example / app/README.md):
//   FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
//   GOOGLE_APPLICATION_CREDENTIALS  (prod runs only — a service-account JSON;
//                                    not needed against the emulator)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RENTALS_FILE = path.join(REPO_ROOT, 'data', 'departamentos.json');
const SALES_FILE = path.join(REPO_ROOT, 'data', 'ventas.json');

const args = process.argv.slice(2);
const YES = args.includes('--yes') || args.includes('-y');
const SKIP_IMAGES = args.includes('--skip-images');
const ONLY = args.includes('--only-rentals') ? 'rentals' : args.includes('--only-sales') ? 'sales' : null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta la variable de entorno ${name}. Ver app/.env.example y app/README.md.`);
    process.exit(1);
  }
  return v;
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, a => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

const EXT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFromPath(p) {
  return path.extname(p).replace('.', '').toLowerCase() || null;
}

async function loadImageBytes(sourceRef) {
  // sourceRef is one of: an absolute http(s) URL (e.g. a Tokko CDN cover
  // photo), an inline base64 data: URI (a handful of legacy entries have
  // the image pasted directly into `imagen` instead of a URL/path), or a
  // local path relative to the repo root, as stored in the existing JSON
  // (e.g. "./images/marie-01/main.jpg") — see docs/catalogo-datos.md.
  const dataUriMatch = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(sourceRef);
  if (dataUriMatch) {
    const contentType = dataUriMatch[1].toLowerCase();
    const ext = EXT_BY_CONTENT_TYPE[contentType] || contentType.split('/')[1] || 'jpg';
    const buf = Buffer.from(dataUriMatch[2], 'base64');
    return { buf, ext, contentType };
  }
  if (/^https?:\/\//i.test(sourceRef)) {
    const res = await fetch(sourceRef);
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${sourceRef}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers.get('content-type') || '').split(';')[0];
    const ext = EXT_BY_CONTENT_TYPE[contentType] || extFromPath(sourceRef) || 'jpg';
    return { buf, ext, contentType: contentType || 'image/jpeg' };
  }
  const localPath = path.join(REPO_ROOT, sourceRef.replace(/^\.\//, ''));
  if (!fs.existsSync(localPath)) {
    throw new Error(`No existe el archivo local: ${localPath}`);
  }
  const buf = fs.readFileSync(localPath);
  const ext = extFromPath(localPath) || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { buf, ext, contentType };
}

async function uploadImage(bucket, destPathNoExt, sourceRef) {
  const { buf, ext, contentType } = await loadImageBytes(sourceRef);
  const finalPath = `${destPathNoExt}.${ext}`;
  await bucket.file(finalPath).save(buf, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  // Public read is granted by storage.rules, not by object ACLs — this URL
  // works because rentals/**, sales/** allow unauthenticated read.
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(finalPath)}?alt=media`;
}

async function migrateRentals(db, bucket) {
  const rentals = JSON.parse(fs.readFileSync(RENTALS_FILE, 'utf8'));
  console.log(`\n=== Alquileres: ${rentals.length} propiedades ===`);
  let ok = 0;
  const failed = [];
  const imageWarnings = [];
  for (const r of rentals) {
    try {
      // A broken/unreachable cover photo (dead source URL, malformed data
      // URI, etc.) is common enough in this dataset that it shouldn't
      // block the rest of the listing's data from migrating — fall back to
      // no image (imagen: '', same as the documented "sin imagen"
      // placeholder behavior) and keep going, instead of skipping the
      // whole record.
      let imagen = r.imagen || '';
      if (imagen && !SKIP_IMAGES) {
        if (YES) {
          try {
            imagen = await uploadImage(bucket, `rentals/${r.id}/cover`, r.imagen);
          } catch (imgErr) {
            console.warn(`  ⚠️  ${r.id}: no se pudo migrar la portada (${imgErr.message}) — se guarda sin imagen`);
            imageWarnings.push(r.id);
            imagen = '';
          }
        } else {
          console.log(`  [dry-run] subiría portada de "${r.id}" (${r.imagen}) -> rentals/${r.id}/cover.*`);
        }
      }
      if (YES) {
        await db.collection('rentals').doc(r.id).set({
          ...r,
          imagen,
          ownerUid: null,
          sellerUid: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      console.log(`  ${YES ? '✅' : '[dry-run]'} ${r.id} — ${r.titulo}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${r.id}: ${e.message}`);
      failed.push(r.id);
    }
  }
  if (imageWarnings.length) {
    console.log(`\n⚠️  Migrados sin portada (revisar manualmente): ${imageWarnings.join(', ')}`);
  }
  console.log(`\nAlquileres: ${ok}/${rentals.length} OK${failed.length ? `, fallaron: ${failed.join(', ')}` : ''}`);
}

async function migrateSales(db, bucket) {
  const sales = JSON.parse(fs.readFileSync(SALES_FILE, 'utf8'));
  console.log(`\n=== Ventas: ${sales.length} propiedades ===`);
  let ok = 0;
  const failed = [];
  const imageWarnings = [];
  for (const s of sales) {
    try {
      let fotos = s.fotos || [];
      if (fotos.length && !SKIP_IMAGES) {
        if (YES) {
          const uploaded = [];
          for (let i = 0; i < fotos.length; i++) {
            try {
              uploaded.push(await uploadImage(bucket, `sales/${s.id}/${i + 1}`, fotos[i]));
            } catch (imgErr) {
              console.warn(`  ⚠️  ${s.id}: no se pudo migrar la foto ${i + 1}/${fotos.length} (${imgErr.message}) — se omite`);
              imageWarnings.push(`${s.id}#${i + 1}`);
            }
          }
          fotos = uploaded;
        } else {
          console.log(`  [dry-run] subiría ${fotos.length} foto(s) de "${s.id}" -> sales/${s.id}/*`);
        }
      }
      if (YES) {
        await db.collection('sales').doc(s.id).set({
          ...s,
          fotos,
          ownerUid: null,
          sellerUid: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      console.log(`  ${YES ? '✅' : '[dry-run]'} ${s.id} — ${s.titulo}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${s.id}: ${e.message}`);
      failed.push(s.id);
    }
  }
  if (imageWarnings.length) {
    console.log(`\n⚠️  Fotos omitidas (revisar manualmente): ${imageWarnings.join(', ')}`);
  }
  console.log(`\nVentas: ${ok}/${sales.length} OK${failed.length ? `, fallaron: ${failed.join(', ')}` : ''}`);
}

async function main() {
  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const storageBucket = requireEnv('FIREBASE_STORAGE_BUCKET');
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (!usingEmulator) {
    const answer = await prompt(
      `\n⚠️  FIRESTORE_EMULATOR_HOST no está seteado — esto va a leer/escribir en el proyecto REAL "${projectId}". ¿Continuar? (s/N): `
    );
    if (!/^s/i.test(answer)) { console.log('Cancelado.'); return; }
  }

  const app = initializeApp({ projectId, storageBucket });
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();

  if (!YES) {
    console.log('\n[dry-run] No se va a escribir nada. Pasá --yes para migrar de verdad.');
  }

  if (ONLY !== 'sales') await migrateRentals(db, bucket);
  if (ONLY !== 'rentals') await migrateSales(db, bucket);

  console.log('\nListo.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
