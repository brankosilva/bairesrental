// Formas de los documentos del sistema de links compartibles por vendedor.
// Se usan tanto del lado cliente (páginas de /app/seller y /app/admin) como
// del lado servidor (server/utils/linkTracking.ts), igual que
// app/types/property.ts.

export type LinkChannel = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'facebook' | 'presencial' | 'otro'

export const LINK_CHANNELS: LinkChannel[] = [
  'whatsapp',
  'instagram',
  'email',
  'sms',
  'facebook',
  'presencial',
  'otro',
]

// Resultado declarado por el vendedor. `pending` es el default al crear.
// No se infiere de la actividad: una apertura no es una respuesta, y un
// clic de WhatsApp tampoco es un cierre — eso lo marca la persona que
// atendió al cliente.
export type LinkOutcome = 'pending' | 'replied' | 'visited' | 'closed' | 'lost'

export const LINK_OUTCOMES: LinkOutcome[] = ['pending', 'replied', 'visited', 'closed', 'lost']

// `property` apunta a una publicación concreta; `catalog` renderiza el
// catálogo entero con la marca del vendedor.
export type LinkTarget = 'property' | 'catalog'

export type PropertyType = 'rental' | 'sale'

export interface TrackableLink {
  // El ID del documento ES el código corto — no se repite acá.
  sellerUid: string
  target: LinkTarget
  // null cuando target === 'catalog'.
  propertyId: string | null
  propertyType: PropertyType | null
  // Snapshot del título al momento de crear el link, para que la tabla del
  // vendedor no tenga que leer una propiedad por fila. Puede quedar viejo si
  // la publicación se renombra; es una etiqueta, no la fuente de verdad.
  propertyTitulo: string | null

  // Cómo llama el vendedor a ESTE link ("Todos los monoambientes",
  // "Campaña de Instagram"). Antes era `recipientName`: el nombre de la
  // persona a la que se lo mandaba, o sea un link por cliente. Terminó
  // siendo un campo obligatorio que había que inventar para poder generar
  // un link, y partía las métricas de una misma publicación en tantas filas
  // como clientes. Ahora es la etiqueta del link y nada más.
  label: string
  // Copia en minúsculas para la query de deduplicación en
  // createTrackableLink (Firestore no tiene comparaciones case-insensitive).
  labelLower: string
  // Nombre viejo del par de arriba. Los links creados antes de este cambio
  // sólo tienen estos dos campos; se leen con `linkLabel()` (ver
  // composables/useLinkStats.ts) y no se escriben nunca más.
  recipientName?: string
  recipientNameLower?: string
  // Por dónde se lo mandó. `null` en el link personal, que no se manda por
  // un canal: es el que va en la bio de Instagram, en la firma, en el estado
  // de WhatsApp.
  channel: LinkChannel | null
  note: string | null
  outcome: LinkOutcome

  // El link personal del vendedor: uno solo por cuenta, creado solo cuando
  // se crea la cuenta, con el slug de su nombre de ID (/l/juan-perez) y
  // apuntado a todo el catálogo. No se desactiva ni se duplica — ver
  // ensurePrimaryLink() en functions/src/index.ts.
  primary?: boolean

  active: boolean
  createdAt?: unknown
  updatedAt?: unknown

  // Contadores. Los escribe SIEMPRE el Admin SDK (server/utils/linkTracking.ts
  // o las Cloud Functions), nunca el cliente — ver firestore.rules.
  //
  // Pueden faltar en links creados antes de esta milestone: FieldValue
  // .increment() crea el campo en su primer incremento, así que no hay
  // backfill. Leerlos siempre con `?? 0`.
  // Aperturas: una por persona y por sesión (media hora). Las cuenta el
  // ping del navegador, no el SSR — antes esto contaba requests, o sea
  // recargas y cada ficha que el cliente mirara adentro del link.
  opens?: number
  // Personas distintas que abrieron el link alguna vez. Avanza sólo la
  // primera vez que un navegador se presenta con un id nuevo, así que
  // falta en todos los links anteriores a esto: leer con `n()` y no
  // mostrarlo como 0 al lado de aperturas viejas.
  visitors?: number
  botOpens?: number
  whatsappClicks?: number
  leads?: number
  // Alias deprecado de `leads`. Se sigue escribiendo una release más porque
  // links viejos sólo tienen este campo. No leer en pantallas nuevas.
  clicks?: number
  firstOpenAt?: unknown
  lastOpenAt?: unknown
}

export type LinkEventType = 'open' | 'whatsapp'

export type LinkDevice = 'iphone' | 'android' | 'ipad' | 'desktop' | 'other'

// Un documento por evento, en links/{code}/opens/{autoId}.
export interface LinkOpenEvent {
  // Desnormalizado a propósito: deja que la regla de Firestore sea
  // `resource.data.sellerUid == request.auth.uid` sin un get() al doc padre
  // (que se cobraría como lectura en cada evaluación de la regla).
  sellerUid: string
  type: LinkEventType
  at: unknown
  // Qué publicación se estaba viendo. En un link de catálogo distingue el
  // grid (null) de una ficha concreta.
  propertyId: string | null
  // Ver server/utils/botDetect.ts: hash salado, la IP cruda NUNCA se guarda.
  visitorHash: string
  device: LinkDevice
  referer: string | null
  lang: string | null
  isBot: boolean
  // Qué regla del filtro disparó, para poder auditar si el filtro se está
  // comiendo gente real.
  botName: string | null
  // Primera vez de ese navegador en cualquier link (sumó a `visitors`).
  visitorNew?: boolean
  // ¿Movió el contador de aperturas? `false` en las fichas que el cliente
  // abre dentro de una sesión ya contada: el evento está para mostrar QUÉ
  // miró, no para volver a contarlo.
  counted?: boolean
}

// Documento público con la identidad del vendedor que se muestra en la
// página compartida. Deliberadamente separado de users/{uid}, que es
// privado: users.phone es un contacto interno que administra el admin,
// sellerProfiles.whatsapp es un número publicado, y tienen que poder diferir.
export interface SellerProfile {
  uid: string
  displayName: string
  title: string | null
  photoUrl: string | null
  // Sólo dígitos, sin '+'. Ver normalizeWhatsapp() en app/utils/format.ts.
  whatsapp: string | null
  bio: string | null
  instagram: string | null
  // Reservados para la personalización de marca que viene después. Hoy no
  // los escribe ninguna pantalla; existen para que esa tanda sea un cambio
  // de datos y no un cambio de esquema.
  logoUrl: string | null
  accentColor: string | null
  slug: string | null
  // Interruptor del admin para despublicar una ficha.
  active: boolean
  updatedAt?: unknown
}
