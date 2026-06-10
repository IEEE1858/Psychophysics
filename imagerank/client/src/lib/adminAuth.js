import { useEffect, useState } from 'react'
import axios from 'axios'

// Shared admin session helpers. Credentials are kept as an HTTP Basic token in
// sessionStorage so every admin route (dashboard, analytics, image detail)
// gates the same way and a shareable link only resolves for a signed-in admin.
export const AUTH_STORAGE_KEY = 'adminAuth'

export function authHeader() {
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY)
  return token ? { Authorization: `Basic ${token}` } : {}
}

// Validates any stored token against the server on mount, then exposes
// sign-in/sign-out. `checking` is only true while a stored token is being
// re-validated, so first-time visitors see the login form immediately.
export function useAdminAuth() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(() => Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY)))

  useEffect(() => {
    if (!sessionStorage.getItem(AUTH_STORAGE_KEY)) {
      return undefined
    }
    let active = true
    axios
      .get('/api/admin/me', { headers: authHeader() })
      .then(() => {
        if (active) {
          setAuthed(true)
        }
      })
      .catch(() => sessionStorage.removeItem(AUTH_STORAGE_KEY))
      .finally(() => {
        if (active) {
          setChecking(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  function signIn(token) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, token)
    setAuthed(true)
  }

  function signOut() {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthed(false)
  }

  return { authed, checking, signIn, signOut }
}
