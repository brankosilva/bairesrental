#!/usr/bin/env node
// Compara las propiedades del catálogo cuyo id empieza con "vera" y están
// marcadas "disponible" contra el texto de la oferta en PDF de Just Like Home.
// Uso: node scripts/check-vera-availability.js <ruta-al-texto-extraido-del-pdf.txt>

const fs = require('fs');
const path = require('path');

function normalize(str) {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca acentos
    .toLowerCase()
    .replace(/[.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const pdfTextPath = process.argv[2];
  if (!pdfTextPath) {
    console.error('Uso: node scripts/check-vera-availability.js <ruta-al-texto-del-pdf.txt>');
    process.exit(1);
  }

  const pdfText = normalize(fs.readFileSync(pdfTextPath, 'utf8'));
  const catalogPath = path.join(__dirname, '..', 'data', 'departamentos.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const veraDisponibles = catalog.filter(
    (d) => d.id && d.id.startsWith('vera') && d.disponibilidad === 'disponible'
  );

  const encontrados = [];
  const posiblesMismatch = [];
  const noEncontrados = [];

  for (const depto of veraDisponibles) {
    const direccion = normalize(depto.direccion || '');
    if (!direccion) continue;

    if (pdfText.includes(direccion)) {
      encontrados.push(depto);
      continue;
    }

    // Separa "calle" de "numero" tomando la parte antes de un cruce ("y otra calle")
    const primeraParte = direccion.split(' y ')[0].trim();
    const match = primeraParte.match(/^(.*?)(\d+)$/);

    if (match) {
      const calle = match[1].trim();
      const calleEnPdf = calle.length > 3 && pdfText.includes(calle);

      if (calleEnPdf) {
        // La calle existe en el PDF pero no con este número exacto:
        // puede ser la misma propiedad con un typo, o directamente otra.
        posiblesMismatch.push(depto);
        continue;
      }
    }

    noEncontrados.push(depto);
  }

  console.log(`\nPropiedades "vera" marcadas DISPONIBLE en el catálogo: ${veraDisponibles.length}`);
  console.log(`Encontradas en el PDF: ${encontrados.length}`);
  console.log(`Posible discrepancia (calle sí, numero no coincide): ${posiblesMismatch.length}`);
  console.log(`NO encontradas en el PDF: ${noEncontrados.length}\n`);

  if (posiblesMismatch.length) {
    console.log('--- REVISAR MANUALMENTE (dirección similar, no exacta en el PDF) ---');
    posiblesMismatch.forEach((d) =>
      console.log(`  ${d.id.padEnd(20)} | ${(d.barrio || '').padEnd(15)} | ${d.direccion}`)
    );
    console.log('');
  }

  if (noEncontrados.length) {
    console.log('--- NO ENCONTRADAS EN EL PDF (candidatas a marcar como no disponible/reservado) ---');
    noEncontrados.forEach((d) =>
      console.log(`  ${d.id.padEnd(20)} | ${(d.barrio || '').padEnd(15)} | ${d.direccion}`)
    );
  } else {
    console.log('Todas las propiedades "vera" disponibles siguen apareciendo en el PDF.');
  }
}

main();
