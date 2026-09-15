import { onMounted, onUnmounted } from 'vue'

// Reimplementa el IntersectionObserver de index.html:1365-1377, que le
// agregaba la clase `.visible` a ~30 elementos a medida que entraban en
// pantalla. Mismo threshold (0.15) y mismo unobserve-al-primer-intersect
// que useCountUp.ts, que es el patrón ya probado en esta app.
//
// SEGURIDAD SSR — esto es lo importante del diseño:
// el `opacity: 0` NO va en el CSS base. Si fuera así, el HTML que sirve el
// servidor saldría invisible y quedaría en blanco para los crawlers y para
// cualquiera cuyo JS falle. En vez de eso, onMounted (que solo corre en el
// cliente, después de hidratar) le pone una clase marcadora al <html>, y el
// CSS esconde los elementos únicamente bajo esa clase:
//
//   html.br-reveal-on .reveal { opacity: 0; transform: translateY(30px) }
//   .reveal.visible            { opacity: 1; transform: none }
//
// Sin JS no hay clase marcadora, no hay opacity:0, y la página se ve
// completa. Ver public/css/br-base.css.

const REVEAL_SELECTOR = [
  '.section-label',
  '.section-title',
  '.feature-card',
  '.plan-card',
  '.testi-card',
  '.stat-item',
  '.reveal',
  '.award-inner',
  '.stats-intro-inner',
].join(', ')

export function useScrollReveal(selector: string = REVEAL_SELECTOR) {
  let observer: IntersectionObserver | undefined

  onMounted(() => {
    // Respetar prefers-reduced-motion: sin clase marcadora, todo se ve de
    // entrada y no se anima nada.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') return

    document.documentElement.classList.add('br-reveal-on')

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )

    for (const el of document.querySelectorAll(selector)) observer.observe(el)
  })

  onUnmounted(() => {
    observer?.disconnect()
    // La clase vive en <html>, fuera del árbol del componente, así que hay
    // que limpiarla a mano al desmontar o la próxima página arranca con
    // todo en opacity:0 sin nadie observando.
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('br-reveal-on')
    }
  })
}
