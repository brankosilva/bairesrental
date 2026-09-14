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
  const display = ref(decimals > 0 ? (0).toFixed(decimals) : '0')
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
      else display.value = decimals > 0 ? target.toFixed(decimals) : target.toLocaleString('es-AR')
    }
    requestAnimationFrame(step)
  }

  onMounted(() => {
    if (!el.value || typeof IntersectionObserver === 'undefined') {
      // SSR pass has no IntersectionObserver — just show the final value
      // so the server-rendered HTML isn't stuck at 0.
      display.value = decimals > 0 ? target.toFixed(decimals) : target.toLocaleString('es-AR')
      return
    }
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
