import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { completeTokenSignIn } from '../lib/auth'
import './pages.css'
import { useT } from '../lib/i18n'

// Read the token from the URL fragment (#token=...) once, at mount.
function tokenFromHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
}

// Landing route for the Google OAuth callback (issue #31). The server redirects
// here with the session token in the URL fragment, which never reaches a server
// or its logs. We store it, resolve the account's participant, then continue
// into the study (or demographics for a brand-new account).
function AuthCompletePage() {
  const navigate = useNavigate()
  const t = useT()
  const [token] = useState(tokenFromHash)
  const [error, setError] = useState(token ? '' : 'Sign-in did not complete. Please try again.')
  // StrictMode double-invokes effects in dev; guard so we only run once.
  const startedRef = useRef(false)

  useEffect(() => {
    if (!token || startedRef.current) {
      return
    }
    startedRef.current = true

    completeTokenSignIn(token)
      .then((participantId) => {
        navigate(participantId != null ? '/study' : '/demographics', { replace: true })
      })
      .catch(() => setError('auth.failed'))
  }, [navigate, token])

  return (
    <main className="page-shell">
      <section className="page-panel">
        <div className="home-status">
          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <>
              <CircularProgress size={28} />
              <span>{t('auth.finishing')}</span>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default AuthCompletePage
