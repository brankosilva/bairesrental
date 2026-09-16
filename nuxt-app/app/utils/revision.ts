// Estado de revisión de una publicación: lo que carga un vendedor no sale al
// sitio hasta que un admin lo aprueba.
//
// Vive en app/utils/ para que Nuxt lo auto-importe (mismo criterio que
// availability.ts y sellerScope.ts) y se importa explícito desde server/, que
// no tiene esos auto-imports.
//
// OJO CON EL DEFAULT, que es la parte que se presta a confusión. `revisionDe()`
// trata la ausencia del campo como 'aprobada', pero eso vale SÓLO para las
// pantallas autenticadas, que leen el catálogo entero y necesitan que un
// documento viejo no aparezca como pendiente en la cola del admin.
//
// Para el público NO hay tolerancia, y son dos mecanismos distintos los que la
// sacan: la query pública lleva `where('revision','==','aprobada')` y un
// `where` no matchea documentos sin el campo, y la regla de firestore.rules
// compara `resource.data.revision` contra un campo que, si no está, hace que la
// condición dé falso. O sea: para un visitante anónimo, sin campo = invisible.
// Por eso el backfill es obligatorio y por eso los scripts escriben el campo
// siempre (ver scripts/lib/catalogo.js).

export type EstadoRevision = 'pendiente' | 'aprobada' | 'rechazada'

export interface Revisable {
  revision?: EstadoRevision
}

export const REVISION_OPTIONS: readonly EstadoRevision[] = ['pendiente', 'aprobada', 'rechazada']

/** El estado de un documento. Sin campo = cargada por el admin antes de que esto existiera. */
export function revisionDe(p: Revisable | null | undefined): EstadoRevision {
  return p?.revision ?? 'aprobada'
}

/** Sale al sitio público, al sitemap y a los links de los vendedores. */
export function estaPublicada(p: Revisable | null | undefined): boolean {
  return revisionDe(p) === 'aprobada'
}

// Se reusan los chips del panel (public/css/br-app.css §4) en vez de inventar
// tres clases nuevas: aprobada verde, pendiente ámbar, rechazada roja es
// exactamente el mismo semáforo que disponible/reservado/baja.
export function revisionClass(estado: EstadoRevision): string {
  if (estado === 'aprobada') return 'br-app-status-disponible'
  if (estado === 'pendiente') return 'br-app-status-reservado'
  return 'br-app-status-baja'
}

// Lo que se lee en pantalla. "aprobada" a secas no dice nada en una lista donde
// casi todo está aprobado; lo que el vendedor y el admin necesitan ver de un
// vistazo es lo que NO está publicado.
export function revisionLabel(estado: EstadoRevision): string {
  if (estado === 'aprobada') return 'publicada'
  if (estado === 'pendiente') return 'en revisión'
  return 'rechazada'
}
