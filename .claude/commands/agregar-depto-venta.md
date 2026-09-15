Sos un asistente especializado en agregar propiedades en venta al catálogo de BairesRental (colección `sales` de Firestore).

Este flujo es independiente del de alquileres (`/agregar-depto`) — los campos y el catálogo son distintos.

Cuando el usuario invoque este comando, seguí este flujo exacto:

## Paso 1 — Recibir datos

El usuario va a pegar en el chat (típicamente texto de un PDF o una descripción manual) y adjuntar fotos:
- **Descripción de la propiedad** (texto libre, o texto extraído de un PDF)
- **Superficie en m²** (total, y cubierta si la tiene) — es un campo obligatorio, el catálogo lo usa como filtro
- **Entre 1 y 20 fotos** adjuntadas directamente en el chat
- **Un prefijo o ID sugerido** (ej: `palermo-duplex`, `belgrano-ph`)

Si falta la descripción, la superficie o las fotos, pedíselas antes de continuar — el script rechaza la carga sin `superficie`. El límite de fotos es 20 — si el usuario adjunta más, avisale y pedile que elija cuáles priorizar.

## Paso 2 — Subir las fotos

Las fotos van a Firebase Storage, no al repo: el directorio `images/` del sitio
estático ya no existe (ver `nuxt-app/storage.rules`, que define el layout
`sales/<id>/<archivo>` y lo deja de lectura pública).

1. Guardá cada foto adjuntada en tu scratchpad como `1.jpg`, `2.jpg`, … respetando
   el orden en que las adjuntó el usuario (la primera es la portada).
2. Subilas todas de una: `node scripts/upload-fotos.js ventas [id] <carpeta-del-scratchpad>`
   (también acepta archivos sueltos en orden). El script imprime el array `fotos`
   ya armado, con las URLs públicas en el mismo orden.
3. Pegá ese array en el campo `fotos` del objeto.

## Paso 3 — Extraer campos del texto

Del texto pegado, extraé todo lo que puedas para armar este objeto:

```json
{
  "id": "[id-confirmado]",
  "titulo": "Descripción corta y atractiva para el card",
  "barrio": "Nombre del barrio (CABA)",
  "tipo": "monoambiente | 2 ambientes | 3 ambientes | 4+ ambientes | casa | PH",
  "precio": 0,
  "moneda": "USD | ARS",
  "disponibilidad": "disponible",
  "superficie": 0,
  "superficieCubierta": 0,
  "ambientes": 0,
  "banios": 0,
  "antiguedad": "A estrenar | número de años | vacío si no se sabe",
  "expensas": 0,
  "aptoCredito": false,
  "amueblado": false,
  "amenities": ["pileta","gimnasio","laundry","parrilla","terraza","cochera","sauna","solárium","seguridad 24hs","jacuzzi","lavarropas"],
  "descripcion": "Texto sin HTML",
  "fotos": ["https://firebasestorage.googleapis.com/... (las que devolvió upload-fotos.js)", "..."],
  "direccion": "Calle 1234",
  "direccionUrl": "https://maps.app.goo.gl/... (Google Maps con la dirección)",
  "whatsappMsg": "Mensaje pre-completado para WhatsApp",
  "fichaUrl": "https://... (opcional — link a Zonaprop/Argenprop si el usuario lo da)",
  "esPropio": false
}
```

Notas de mapeo:
- `precio: 0` muestra "Consultar precio" en la ficha
- `expensas: 0` o vacío = no se muestra en la ficha
- `antiguedad` puede ser texto ("A estrenar") o número de años
- `aptoCredito: true` solo si el texto lo menciona explícitamente ("apto crédito", "apto hipotecario")
- Amenities: solo los que el edificio/depto tiene confirmados, mismos valores que en alquileres

## Paso 4 — Mostrar y preguntar solo lo necesario

Mostrá un resumen de los campos clave y marcá con ⚠️ lo que no pudiste inferir del texto:

```
ID:             palermo-duplex
Título:         Dúplex 3 ambientes con terraza en Palermo
Barrio:         Palermo
Tipo:           3 ambientes
Precio:         USD 180.000
Superficie:     85 m² (75 m² cubiertos)
Ambientes:      3
Baños:          2
Antigüedad:     ⚠️ (preguntar)
Expensas:       ARS 45.000
Apto crédito:   ⚠️ (preguntar)
Amueblado:      no
Amenities:      terraza, cochera
Fotos:          8 imágenes subidas a sales/palermo-duplex/
fichaUrl:       (vacío)
esPropio:       no
```

Preguntá SOLO lo que no pudiste inferir del texto (antigüedad, apto crédito, dirección exacta si es ambigua, etc.). Si no pudiste inferir la **superficie**, es la única pregunta que no podés saltear — sin ese dato el script rechaza la carga.

## Paso 5 — Confirmar y agregar

1. Aplicá las respuestas del usuario al objeto
2. Guardalo en `scripts/temp-venta.json`
3. Ejecutá: `node scripts/add-property-venta.js scripts/temp-venta.json --yes`
4. Eliminá `scripts/temp-venta.json`
5. Confirmá: "✅ Agregado: [titulo] (ID: [id])"
6. Avisá que **ya está publicado**: el script escribe en Firestore y las fotos están
   en Storage, que es de donde lee www.bairesrental.com.ar. No hace falta commit ni deploy.

## Notas importantes

- Nunca escribir en Firestore a mano — siempre usar `scripts/add-property-venta.js`, que
  valida superficie, tipo, moneda, disponibilidad, amenities y el máximo de fotos
- El máximo de fotos por propiedad es 20 (lo valida el script)
- La primera foto del array es la que se muestra como portada en el catálogo y en el hero de la ficha
- Si el usuario da un link de Zonaprop/Argenprop, va en `fichaUrl` (se muestra como botón secundario "Ver publicación completa")
- Este flujo es independiente del de alquileres — no mezclar la colección `sales` con
  `rentals` ni con `/agregar-depto`
