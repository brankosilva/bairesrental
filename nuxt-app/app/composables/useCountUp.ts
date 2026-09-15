import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface UseCountUpOptions {
  target: number
  decimals?: number
  duration?: number // ms
}

// Ported verbatim from app/src/composables/useCountUp.ts (see its header
// comment for the full rationale — reimplements the original static
// site's vanilla animateCount()/IntersectionObserver combo). Nothing
// SSR-specific to change: it only touches IntersectionObserver/
// requestAnimationFrame inside onMounted, which never runs during SSR
// under Nuxt either.
export function useCountUp(options: UseCountUpOptions) {
  const { target, decimals = 0, duration = 1600 } = options
  const el: Ref<HTMLElement | null> = ref(null)

  function finalValue(): string {
    return decimals > 0 ? target.toFixed(decimals) : target.toLocaleString('es-AR')
  }

  // Arranca en el valor FINAL, no en 0. El SSR no corre onMounted, así que
  // si arrancara en 0 el HTML que sirve el servidor diría "0+ huéspedes
  // recibidos" — que es lo que ve un crawler y lo que se ve en el primer
  // paint antes de hidratar. Arrancando en el valor final, servidor y
  // cliente coinciden en la hidratación y recién después el cliente lo
  // baja a 0 para animar (ver onMounted).
  const display = ref(finalValue())
  let observer: IntersectionObserver | undefined

  function format(value: number): string {
    return decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString('es-AR')
  }

  function animate() {
    const start = performance.now()
    function step(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      display.value = format(target * eased)
      if (p < 1) requestAnimationFrame(step)
      else display.value = finalValue()
    }
    requestAnimationFrame(step)
  }

  onMounted(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!el.value || reduced || typeof IntersectionObserver === 'undefined') {
      // Sin observer (o con reduced-motion) no se anima nada: queda el valor
      // final, que es con el que ya se hidrató.
      return
    }
    // Recién acá, ya hidratado y solo en el cliente, se baja a 0 para poder
    // contar hacia arriba cuando la sección entre en pantalla.
    display.value = decimals > 0 ? (0).toFixed(decimals) : '0'
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate()
            observer?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el.value)
  })

  onUnmounted(() => observer?.disconnect())

  return { el, display }
}
