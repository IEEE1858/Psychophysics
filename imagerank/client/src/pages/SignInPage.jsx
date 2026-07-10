import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import { login, register } from '../lib/auth'
import './pages.css'

// Human-readable messages for the ?error= codes the server sends back when a
// Google sign-in round-trip fails.
const GOOGLE_ERRORS = {
  google_unavailable: 'Google sign-in is not configured. Please use an email and password.',
  google_denied: 'Google sign-in was cancelled.',
  bad_state: 'Your sign-in session expired. Please try again.',
  google_failed: 'Google sign-in failed. Please try again.',
}

// Optional participant sign-in (issue #31). Returning participants use this to
// resume their study on a new browser or device; new participants can create an
// account here or just start the study anonymously from the home page.
function SignInPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(GOOGLE_ERRORS[searchParams.get('error')] || '')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const participantId = isRegister
        ? await register(email.trim(), password)
        : await login(email.trim(), password)
      // Resume where the account left off, or collect demographics if new.
      navigate(participantId != null ? '/study' : '/demographics')
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          'Could not reach the server. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="page-panel admin-login">
        <header className="preview-header">
          <Link className="back-link" to="/">
            ← Back to home
          </Link>
          <p className="eyebrow">Your account</p>
          <h1>{isRegister ? 'Create an account' : 'Sign in'}</h1>
          <p className="home-lead">
            {isRegister
              ? 'Create an optional account to save your progress and continue on another device.'
              : 'Sign in to resume your study on this or another device. Signing in is optional.'}
          </p>
        </header>

        <form className="form-card admin-login-card" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            fullWidth
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            helperText={isRegister ? 'At least 8 characters.' : undefined}
            fullWidth
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <div className="form-actions">
            <Button
              type="submit"
              variant="contained"
              size="large"
              className="cta-button"
              disabled={submitting}
            >
              {submitting
                ? isRegister
                  ? 'Creating account…'
                  : 'Signing in…'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
            </Button>
          </div>

          <Divider>or</Divider>

          <Button
            variant="outlined"
            size="large"
            fullWidth
            href="/api/auth/google/start"
          >
            Continue with Google
          </Button>

          <p className="cta-note" style={{ textAlign: 'center' }}>
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setError('')
                setMode(isRegister ? 'login' : 'register')
              }}
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </main>
  )
}

export default SignInPage
