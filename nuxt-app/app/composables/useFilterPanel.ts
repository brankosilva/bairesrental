import { onUnmounted, ref, watch } from 'vue'

// Panel de filtros del catálogo, compartido por /departamentos y /ventas.
//
// Los dos catálogos tenían la misma lógica duplicada (`sheetOpen` + un watch
// que lockeaba el scroll + un listener de resize). Acá vive una sola vez.
//
// El resize handler que cerraba el panel arriba de 768px se eliminó: el panel
// ya no es solo mobile. A partir de 769px se presenta como un dropdown
// anclado bajo la barra sticky en vez de un bottom sheet — ver
// `.br-filtros-panel` en br-catalog.css.
const MOBILE_BP = 768

export function useFilterPanel() {
  const open = ref(false)

  // El lock de scroll es solo para el sheet mobile, que tapa la pantalla
  // entera. En escritorio el dropdown flota sobre la página y congelarla
  // haría que la rueda del mouse no responda con el panel abierto.
  function lockBody(locked: boolean) {
    const isMobile = window.innerWidth <= MOBILE_BP
    document.body.style.overflow = locked && isMobile ? 'hidden' : ''
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open.value = false
  }

  watch(open, (isOpen) => {
    lockBody(isOpen)
    if (isOpen) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  })

  return {
    open,
    toggle: () => (open.value = !open.value),
    close: () => (open.value = false),
  }
}
