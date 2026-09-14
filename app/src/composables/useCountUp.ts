import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface UseCountUpOptions {
  target: number
  decimals?: number
  duration?: number // ms
}

// Reimplements index.html's vanilla animateCount()/IntersectionObserver
// combo (see app/CHANGELOG.md M2/M7 — the original couldn't be reused
// as-is in Vue) as a small reactive composable: attach `el` to a template
// ref, and `display` renders the eased count-up once the element scrolls
// into view. Same cubic ease-out and ~1.6s duration as the original.
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
      // SSR/prerender pass has no IntersectionObserver — just show the
      // final value so the static HTML isn't stuck at 0.
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
