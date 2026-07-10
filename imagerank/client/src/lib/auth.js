import { useEffect, useState } from 'react'
import axios from 'axios'
import { getParticipantId, setParticipantId } from './session'

// Optional participant accounts (issue #31). A signed session token is kept in
// localStorage (survives restarts, so a returning participant stays signed in)
// and sent as a Bearer header. Signing in resolves the account's participant so
// progress resumes across devices. This is entirely separate from admin auth
// (see lib/adminAuth.js), which uses sessionStorage + HTTP Basic.
const AUTH_TOKEN_KEY = 'authToken'

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function authHeader() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Reconcile the local study session with a just-signed-in account and return
// the participant id to resume into (or null → the account has no participant
// yet, so the caller should route to the demographics form).
//
// - If there's an in-progress anonymous session on this device, attach it to
//   the account (so the current progress is saved under it) and keep it.
// - Otherwise adopt the participant the account already owns.
async function reconcileParticipant(accountParticipantId) {
  const localId = getParticipantId()
  if (localId) {
    try {
      await axios.post('/api/auth/link', { participantId: Number(localId) }, { headers: authHeader() })
    } catch {
      // Best-effort: the local session stays usable even if linking fails.
    }
    return localId
  }
  if (accountParticipantId != null) {
    setParticipantId(accountParticipantId)
    return accountParticipantId
  }
  return null
}

// Store the token from a register/login response, then reconcile the session.
async function finalize({ token, participantId }) {
  setAuthToken(token)
  return reconcileParticipant(participantId)
}

export async function register(email, password) {
  const { data } = await axios.post('/api/auth/register', { email, password })
  return finalize(data)
}

export async function login(email, password) {
  const { data } = await axios.post('/api/auth/login', { email, password })
  return finalize(data)
}

// Complete a Google sign-in once the OAuth callback has handed us a token in the
// URL fragment. Fetches the account, then reconciles the session.
export async function completeTokenSignIn(token) {
  setAuthToken(token)
  const { data } = await axios.get('/api/auth/me', { headers: authHeader() })
  return reconcileParticipant(data.participantId)
}

// Validates any stored token against the server on mount, then exposes the
// account and a signOut. `checking` is only true while re-validating a stored
// token, so first-time visitors are treated as signed-out immediately.
export function useAuth() {
  const [account, setAccount] = useState(null)
  const [checking, setChecking] = useState(() => Boolean(getAuthToken()))

  useEffect(() => {
    if (!getAuthToken()) {
      return undefined
    }
    let active = true
    axios
      .get('/api/auth/me', { headers: authHeader() })
      .then((response) => {
        if (active) {
          setAccount(response.data.account)
        }
      })
      .catch(() => clearAuthToken())
      .finally(() => {
        if (active) {
          setChecking(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  function signOut() {
    clearAuthToken()
    setAccount(null)
  }

  return { account, authed: Boolean(account), checking, signOut }
}
