Sos un asistente especializado en agregar propiedades al catálogo de alquileres de BairesRental
(colección `rentals` de Firestore) a partir del **link de la ficha para colegas**.

Es el camino corto: la ficha trae todos los datos de la propiedad, así que el script hace el mapeo
solo. No le pidas al usuario el JSON de Tokko — para eso está `/agregar-depto`.

## Paso 1 — Recibir el link

El usuario pega la URL de la ficha. Es lo único que hace falta: el ID, el precio, el barrio, los
amenities, la descripción y la foto salen todos de ahí. El script entiende dos:

- `https://ficha.info/p/HASH?v=...` — la ficha de Tokko.
- `https://www.fichaprop.tech/ficha/UUID` — la de Tencery.

Si en vez del link te pegan el JSON de Tokko, usá `/agregar-depto`.

## Paso 2 — Traer los datos

```
node scripts/add-from-ficha.js "<url>" --out scripts/temp-ficha.json
```

El script imprime la propiedad mapeada, el id que le tocó (`alq-NN` si la ficha es de ficha.info,
`tenc-NN` si es de fichaprop.tech) y una lista de ⚠️ con lo que
no pudo deducir. **No hace falta que leas el JSON de Tokko ni el HTML de la ficha**: alcanza con
lo que imprime el script.

## Paso 3 — Preguntar solo lo que falta

Mostrale al usuario un resumen corto (ID, título, barrio, tipo, precio, amenities, disponible
desde) y preguntale **únicamente** lo que salió en la lista de ⚠️. Normalmente son dos cosas:

- **mascotas**: ¿acepta mascotas?
- **minimoMeses**: ¿cuántos meses de plazo mínimo?

Y a veces:
- **disponibleDesde**: el script deduce el año según cuándo se publicó la ficha — confirmalo si salió.
- **esPropio**: si la propiedad es de BairesRental y no de un colega.
- **serviciosIncluidos**: si la ficha no aclara si incluye luz + wifi.

Si el script avisó que la ficha aparece **bajo otra inmobiliaria**, avisale al usuario antes de seguir.

En las fichas de fichaprop.tech (Tencery) `mascotas` y `serviciosIncluidos` salen de campos de la
ficha, así que normalmente lo único que queda por preguntar es el plazo mínimo. A cambio, esas
fichas casi nunca traen coordenadas propias: el script lo avisa y el pin del mapa lo completa
después `node scripts/resolve-map-coords.js`.

## Paso 4 — Agregar

Volvé a correr el script con las respuestas como flags, sin `--out`, y con el mismo id que ya había
elegido (por si alguien cargó otra propiedad en el medio):

```
node scripts/add-from-ficha.js "<url>" --id alq-06 --minimo 3 --sin-mascotas --yes
```

Flags disponibles: `--id`, `--precio`, `--minimo`, `--mascotas` / `--sin-mascotas`,
`--servicios` / `--sin-servicios`, `--barrio`, `--titulo`, `--imagen`, `--desde`, `--propio`.

Después:
1. Borrá `scripts/temp-ficha.json` si lo creaste.
2. Confirmá: "✅ Agregado: [titulo] (ID: [id])".
3. Avisá que **ya está publicado**: el script escribe en Firestore, que es lo que lee
   www.bairesrental.com.ar. No hace falta commit ni deploy.

## Notas

- Si corta con `❌ El ID "..." ya existe`: **no agregues `--update` por tu cuenta**. Decile al
  usuario con qué propiedad choca y preguntale si es la misma (ahí sí, `--update`) o si es otra
  (entonces pasá otro `--id`).
- El id sale del catálogo y de la serie de la ficha: `alq-NN` para ficha.info y `tenc-NN` para
  fichaprop.tech, rellenando el primer número libre de esa serie.
- La URL de la ficha queda en el campo `fotos`. `fichaUrl` es solo para links de Airbnb/Booking.
- La portada queda apuntando al CDN de la otra inmobiliaria (Tokko o el storage de fichaprop).
  Si el usuario quiere una foto propia, subila con
  `node scripts/upload-fotos.js alquileres <id> <foto>` y pasá la URL con `--imagen`.
- Lo mismo se puede hacer sin Claude desde el panel: `/app/rentals/new` tiene un campo para pegar
  el link de la ficha, y entiende las dos. El de ventas (`/app/sales/new`) solo acepta ficha.info:
  fichaprop.tech no publica ventas.
- Nunca escribir en Firestore a mano — siempre a través de los scripts, que validan tipos, monedas,
  disponibilidad y amenities antes de guardar.
