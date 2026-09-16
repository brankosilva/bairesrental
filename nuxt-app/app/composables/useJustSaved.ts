import { computed, ref, type Ref } from 'vue'
import type { PropertyKind } from '~/utils/availability'

// «Recién guardada»: la confirmación que muestran las listas del panel al
// volver de un formulario.
//
// EL PROBLEMA NO ES QUE LA LISTA QUEDE VIEJA. Vuelve a pedir la colección
// entera al montarse (listAll en el onMounted de cada página), así que el
// documento nuevo ya viene. El problema es que Firestore devuelve los
// documentos ORDENADOS POR ID: una propiedad nueva cae en cualquier lado de
// una lista de ~85 y quien la acaba de cargar no la ve por ningún lado. Sin
// ninguna señal, eso se lee como "no se guardó" — y se vuelve a cargar.
//
// El formulario avisa por la query (?saved=<id>&kind=rental[&new=1]) y acá se
// resuelve contra las filas YA CARGADAS: el cartel sale sólo si la propiedad
// aparece en lo que acaba de devolver Firestore, o sea que es prueba de que se
// guardó, no una promesa optimista del formulario.
//
// `kind` es para seller/listings, que tiene las dos colecciones en pestañas:
// cada instancia ignora lo guardado en la otra.
export function useJustSaved<T extends { id: string }>(rows: Ref<T[]>, kind: PropertyKind) {
  const route = useRoute()
  const closed = ref(false)

  const savedId = computed(() => {
    if (closed.value || route.query.kind !== kind) return ''
    return typeof route.query.saved === 'string' ? route.query.saved : ''
  })

  const isNew = computed(() => route.query.new === '1')
  const saved = computed<T | null>(() =>
    savedId.value ? (rows.value.find((r) => r.id === savedId.value) ?? null) : null,
  )

  // Para .sort(): la recién guardada arriba de todo. El resto queda como venía
  // — Array.prototype.sort es estable.
  function savedFirst(a: T, b: T): number {
    return Number(b.id === savedId.value) - Number(a.id === savedId.value)
  }

  return { savedId, isNew, saved, savedFirst, close: () => (closed.value = true) }
}
