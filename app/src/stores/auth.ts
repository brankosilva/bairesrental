import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from 'firebase/auth'

export type Role = 'admin' | 'seller' | 'owner' | null

// Client-side only — never touched during the SSG prerender pass (no
// route in the public catalog reads this), so it's safe for this store to
// assume a browser environment (onAuthStateChanged, etc.).
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const role = ref<Role>(null)
  const ready = ref(false)

  async function init() {
    if (ready.value) return
    const { getAuth, onAuthStateChanged } = await import('firebase/auth')
    const { getFirebaseApp } = await import('../firebase/client')
    const auth = getAuth(getFirebaseApp())
    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        user.value = u
        if (u) {
          // Custom claims (role) live on the ID token, set by the
          // setUserRole Cloud Function — force-refresh so a just-assigned
          // role is picked up without requiring a fresh login.
          const token = await u.getIdTokenResult(true)
          role.value = (token.claims.role as Role) ?? null
        } else {
          role.value = null
        }
        ready.value = true
        resolve()
      })
    })
  }

  async function login(email: string, password: string) {
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
    const { getFirebaseApp } = await import('../firebase/client')
    const auth = getAuth(getFirebaseApp())
    await signInWithEmailAndPassword(auth, email, password)
    const token = await auth.currentUser?.getIdTokenResult(true)
    role.value = (token?.claims.role as Role) ?? null
  }

  async function logout() {
    const { getAuth, signOut } = await import('firebase/auth')
    const { getFirebaseApp } = await import('../firebase/client')
    await signOut(getAuth(getFirebaseApp()))
    user.value = null
    role.value = null
  }

  return { user, role, ready, init, login, logout }
})
