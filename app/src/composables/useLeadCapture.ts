import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const STORAGE_KEY = 'br_ref'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days — standard attribution-window length

export function storeRefCode(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, capturedAt: Date.now() }))
  } catch {
    // localStorage can throw (private browsing, blocked storage) — losing
    // attribution isn't worth breaking the redirect over.
  }
}

function readStoredRefCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { code, capturedAt } = JSON.parse(raw)
    if (Date.now() - capturedAt > TTL_MS) return null
    return code || null
  } catch {
    return null
  }
}

// The approved UX decision (see the plan): when a visitor arrived via a
// seller's tracked link, capture name+phone before handing them off to
// WhatsApp, so the seller's CRM tracks an actual identified lead instead
// of just a click. Organic visitors (no ref code, ever) see the plain
// WhatsApp link unchanged — zero UX change for them.
export function useLeadCapture(propertyId: string | null, propertyType: 'rental' | 'sale' | null) {
  const route = useRoute()
  const refCode = computed(() => (route.query.ref as string) || readStoredRefCode())
  const showCaptureForm = computed(() => !!refCode.value)

  const name = ref('')
  const phone = ref('')
  const submitting = ref(false)

  async function submitAndGetWhatsappRedirect(whatsappUrl: string) {
    submitting.value = true
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions')
      const { getFirebaseApp } = await import('../firebase/client')
      const submitLead = httpsCallable(getFunctions(getFirebaseApp(), 'southamerica-east1'), 'submitLead')
      await submitLead({
        code: refCode.value,
        propertyId,
        propertyType,
        name: name.value,
        phone: phone.value,
      })
    } catch (e) {
      // Don't block the visitor's contact attempt if lead-capture fails —
      // losing CRM attribution is preferable to losing the lead entirely.
      console.error('submitLead failed', e)
    } finally {
      submitting.value = false
      window.location.href = whatsappUrl
    }
  }

  return { showCaptureForm, name, phone, submitting, submitAndGetWhatsappRedirect }
}
