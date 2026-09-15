// Shared client-side role read off ID token custom claims — same source
// of truth as app/middleware/auth.ts (never a Firestore doc read).
//
// Deliberately a plain async function, not a reactive composable with its
// own onMounted: two independent onMounted hooks (this one's, plus a
// page's own) run in registration order but aren't awaited against each
// other, so a page that needs the role *before* proceeding with its own
// async logic (e.g. RentalForm/SaleForm deciding whether to prefill
// sellerUid) must await this inline in its own onMounted instead of
// racing a separate one.
//
// Explicit `import { useCurrentUser } from 'vuefire'` (bypassing the
// auto-import transform) since this is a plain utils file — safe to call
// from anywhere: useCurrentUser() looks up a WeakMap keyed by the Firebase
// app singleton, not by Vue component instance (confirmed in
// node_modules/vuefire/dist/shared/vuefire.*.mjs).
import { useCurrentUser } from 'vuefire'

export async function fetchUserRole(): Promise<string | null> {
  const user = useCurrentUser()
  if (!user.value) return null
  const tokenResult = await user.value.getIdTokenResult()
  return (tokenResult.claims.role as string | undefined) ?? null
}
