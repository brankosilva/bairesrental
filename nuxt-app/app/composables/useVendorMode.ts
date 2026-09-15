import { computed } from 'vue'

// Modo vendedor — el equivalente Nuxt de catalogo-vendedores.html /
// ficha-vendedor.html, que no se habían migrado: un vendedor no tenía
// ninguna URL de la app para mandarle a un cliente.
//
// En el sitio estático eran dos archivos duplicados (copias de
// departamentos.html y departamento.html) con cuatro cambios, manejados por
// un flag global: `window.BR_VENDOR_MODE = true`, que js/departamentos.js:11
// leía para esconder los botones de WhatsApp y apuntar las fichas a la
// versión sin WhatsApp.
//
// Acá se resuelve con `?vendor=1` sobre las rutas que ya existen, así no hay
// páginas duplicadas que mantener en paralelo. El flag hace:
//   · esconde todos los botones de WhatsApp (cards, ficha, sin-resultados)
//   · "Compartir" pasa a ser un botón ancho con texto (.br-btn-compartir-full)
//   · el nav queda en logo + selector de idioma, sin links ni CTA ni drawer
//   · esconde los FABs de WhatsApp/Instagram
//   · esconde el botón "Comunidad" del hero
//   · robots: noindex, nofollow
export function useVendorMode() {
  const route = useRoute()
  const isVendor = computed(() => route.query.vendor === '1')

  // Propaga el flag a los links internos, para que navegar del catálogo a una
  // ficha no salga del modo vendedor.
  function vendorLink(path: string) {
    return isVendor.value ? `${path}?vendor=1` : path
  }

  return { isVendor, vendorLink }
}
