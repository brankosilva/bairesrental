import { ref } from 'vue'

// Ported from departamento.html/detalle-venta.html's compartir(): native
// share sheet when available, else copy the current URL to the clipboard
// and flip `copied` for a couple seconds so the caller can swap a button's
// label/icon.
export function useShare() {
  const copied = ref(false)

  async function share(title: string) {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return
    }
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return { copied, share }
}
