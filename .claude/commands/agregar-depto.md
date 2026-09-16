Sos un asistente especializado en agregar propiedades al catálogo de alquileres de BairesRental (colección `rentals` de Firestore).

Cuando el usuario invoque este comando, seguí este flujo exacto:

## Paso 1 — Recibir datos

El usuario va a pegar en el chat:
- **El JSON de Tokko** (lo obtiene por su cuenta y lo pega directamente)
- **La URL de ficha.info para colegas** (ej: `https://ficha.info/p/HASH?v=...`) — esta va en el campo `fotos`
- **El prefijo del ID** (ej: `marie`, `pedro`, `juan`) — luego vos buscás el próximo número libre

Si falta alguno de estos tres datos, pedíselos antes de continuar.

Para encontrar el próximo número libre dado un prefijo (ej: "marie"):
```
node -e "require('./scripts/lib/catalogo').leerCatalogo('alquileres').then(d=>{const nums=d.filter(p=>p.id.startsWith('marie-')).map(p=>parseInt(p.id.split('-')[1])).filter(n=>!isNaN(n)).sort((a,b)=>a-b); let n=1; while(nums.includes(n)) n++; console.log('marie-'+String(n).padStart(2,'0')); process.exit(0);})"
```
(reemplazá `marie` por el prefijo que dijo el usuario)

Mostrá el ID sugerido al usuario y pedí confirmación o corrección antes de continuar.

## Paso 2 — Procesar

1. Guardá el JSON en `scripts/temp-tokko.json`
2. Ejecutá: `node scripts/add-from-tokko.js scripts/temp-tokko.json --out scripts/temp-mapped.json`
3. Leé `scripts/temp-mapped.json`
4. Aplicá automáticamente:
   - Poné la URL de ficha.info en el campo `fotos` (NO en `fichaUrl` — ese es para Airbnb/Booking)
   - Dejá `fichaUrl` vacío salvo que el usuario dé un link de Airbnb o Booking
   - Reemplazá `id` con el ID confirmado
   - Si `owner_name` es "Branko C" o `can_edit: true` en el JSON original → `esPropio: true`
   - Si la descripción contiene "servicios incluidos" o "expensas y servicios" → `serviciosIncluidos: true`
5. Guardá los cambios en `scripts/temp-mapped.json`

## Paso 3 — Mostrar y preguntar solo lo necesario

Mostrá un resumen de los campos clave:
```
ID:             [prefijo]-XX
Título:         Monoambiente en Balvanera
Barrio:         Balvanera
Tipo:           monoambiente
Precio:         USD 500/mes
Mínimo:         3 meses  ← auto-detectado de descripción
Amueblado:      sí
Mascotas:       ❓ (preguntar)
Servicios inc.: no
Amenities:      terraza, lavarropas  ← auto-detectados
fotos:          https://ficha.info/p/...  ← ficha.info va acá
fichaUrl:       (vacío — solo para Airbnb/Booking)
esPropio:       no
```

Preguntá SOLO lo que no pudiste inferir:
- **mascotas**: ¿acepta mascotas? (sí/no)
- Si `minimoMeses` quedó en 1 y la descripción no lo aclara: ¿cuántos meses mínimo?
- Si hay algo ambiguo en barrio o título, consultá

## Paso 4 — Confirmar y agregar

1. Aplicá las respuestas del usuario a `scripts/temp-mapped.json`
2. Ejecutá: `node scripts/add-property.js scripts/temp-mapped.json --yes`
3. Si corta con `❌ El ID "..." ya existe`: **no agregues `--update` por tu cuenta**. El id
   sale de un slug de la dirección, así que dos unidades del mismo edificio chocan solas.
   Decile al usuario con qué propiedad choca y preguntale si es la misma (ahí sí, `--update`)
   o si es otra (entonces cambiá el `id` en el JSON, ej. `bauness-1100-2b`, y reintentá)
4. Eliminá `scripts/temp-tokko.json` y `scripts/temp-mapped.json`
5. Confirmá: "✅ Agregado: [titulo] (ID: [id])"
6. Avisá que **ya está publicado**: el script escribe en Firestore, que es lo que
   lee www.bairesrental.com.ar. No hace falta commit ni deploy para que aparezca.

## Notas importantes

- El script ya auto-detecta `minimoMeses` desde la descripción ("Plazo mínimo: X meses")
- El script ya auto-detecta amenities mencionados en la descripción (lavarropas, terraza, pileta, etc.)
- `serviciosIncluidos: true` si la descripción dice "servicios incluidos", "expensas y servicios", "incluye luz y wifi"
- `esPropio: true` si `owner_name` en el JSON es "Branko C" o `can_edit: true`
- La imagen queda como URL externa de Tokko CDN (puede expirar si dan de baja el listado)
- Si el usuario adjunta una foto propia en el chat, guardala en el scratchpad y subila con
  `node scripts/upload-fotos.js alquileres <id> <foto>` — devuelve la URL pública de
  Firebase Storage para el campo `imagen`. Ya no existe el directorio `images/` local.
- Nunca escribir en Firestore a mano — siempre a través de los scripts, que validan
  tipos, monedas, disponibilidad y amenities antes de guardar
