#!/usr/bin/env node
/**
 * Genera los derivados 1200x630 que usan los previews de link (og:image) para
 * las portadas que YA estaban subidas.
 *
 * Por qué hace falta: la extensión `storage-resize-images` solo corre ante un
 * upload nuevo. No tiene backfill — los parámetros están comenteados upstream
 * en su extension.yaml — así que las 87 portadas que ya están en el bucket no
 * tienen derivado hasta que el objeto se vuelva a escribir. Eso es todo lo que
 * hace este script: reescribe cada portada sobre sí misma (`copy` al mismo
 * path), lo que crea una generación nueva, dispara el finalize y hace que la
 * extensión genere el `_1200x630`.
 *
 * ORDEN DE LOS PASOS (importante):
 *   1. Instalar la extensión (ver docs/og-previews.md).
 *   2. node scripts/backfill-og-images.js          → chequea, no escribe nada.
 *   3. node scripts/backfill-og-images.js --run    → reescribe las que falten.
 *   4. node scripts/backfill-og-images.js          → confirmar que quedó 0 faltante.
 *   5. Recién ahí desplegar el sitio.
 * Si se despliega antes del paso 4, las fichas quedan apuntando a un og:image
 * que devuelve 404 y el preview sale peor que ahora.
 *
 * Uso:
 *   node scripts/backfill-og-images.js [--run] [--only <id>] [--concurrency N]
 */

import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUFFIX = '_1200x630'
const EXT_VALIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const args = process.argv.slice(2)
const APLICAR = args.includes('--run')
const SOLO = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const CONCURRENCIA = args.includes('--concurrency') ? Number(args[args.indexOf('--concurrency') + 1]) : 5

const serviceAccount = JSON.parse(readFileSync(path.join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'bairesrental.firebasestorage.app',
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

/** De una URL de descarga de Storage saca el path del objeto dentro del bucket. */
function storagePath(url) {
  if (!url) return null
  const m = url.match(/\/o\/([^?#]+)/)
  if (!m) return null
  return decodeURIComponent(m[1])
}

function derivado(objectPath) {
  const ext = path.extname(objectPath).toLowerCase()
  if (!EXT_VALIDAS.has(ext)) return null
  return `${objectPath.slice(0, -ext.length)}${SUFFIX}${ext}`
}

async function portadas() {
  const [rentals, sales] = await Promise.all([db.collection('rentals').get(), db.collection('sales').get()])
  const out = []
  rentals.forEach((d) => out.push({ col: 'rentals', id: d.id, url: d.data().imagen }))
  sales.forEach((d) => out.push({ col: 'sales', id: d.id, url: (d.data().fotos || [])[0] }))
  return out.filter((p) => (SOLO ? p.id === SOLO : true))
}

/** Corre `fn` sobre `items` con un tope de tareas en paralelo. */
async function enLotes(items, limite, fn) {
  const resultados = []
  let i = 0
  const workers = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      resultados[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return resultados
}

async function main() {
  const lista = await portadas()
  console.log(`${lista.length} portadas en Firestore${SOLO ? ` (filtrado a "${SOLO}")` : ''}`)
  console.log(APLICAR ? '\nMODO --run: se van a reescribir las portadas sin derivado.\n' : '\nMODO CHEQUEO (sin --run no escribe nada).\n')

  const estado = await enLotes(lista, CONCURRENCIA, async (p) => {
    if (!p.url) return { ...p, estado: 'sin-portada' }

    const objectPath = storagePath(p.url)
    if (!objectPath) return { ...p, estado: 'externa' } // CDN de Tokko/Airbnb: no la generamos nosotros

    const destino = derivado(objectPath)
    if (!destino) return { ...p, estado: 'extension-no-soportada', objectPath }

    const [existe] = await bucket.file(destino).exists()
    if (existe) return { ...p, estado: 'ok', destino }

    if (!APLICAR) return { ...p, estado: 'falta', objectPath, destino }

    const original = bucket.file(objectPath)
    const [existeOriginal] = await original.exists()
    if (!existeOriginal) return { ...p, estado: 'original-ausente', objectPath }

    // Copiar el objeto sobre sí mismo crea una generación nueva y dispara el
    // finalize que la extensión escucha. No cambia bytes ni token.
    await original.copy(original)
    return { ...p, estado: 'disparado', objectPath, destino }
  })

  const porEstado = {}
  for (const e of estado) (porEstado[e.estado] ||= []).push(e)

  for (const [k, v] of Object.entries(porEstado).sort()) {
    console.log(`${String(v.length).padStart(4)}  ${k}`)
    if (k !== 'ok') v.slice(0, 10).forEach((e) => console.log(`        ${e.col}/${e.id}${e.objectPath ? ` — ${e.objectPath}` : ''}`))
    if (k !== 'ok' && v.length > 10) console.log(`        … y ${v.length - 10} más`)
  }

  const faltan = (porEstado.falta || []).length
  if (!APLICAR && faltan > 0) {
    console.log(`\n⚠️  ${faltan} portadas sin derivado. Correr de nuevo con --run.`)
    process.exitCode = 1
  }
  if (APLICAR) {
    console.log('\nLa extensión tarda unos segundos por imagen. Volver a correr sin --run para confirmar.')
  }
  if (!APLICAR && faltan === 0) {
    console.log('\n✅ Todas las portadas tienen su derivado 1200x630. Se puede desplegar.')
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
