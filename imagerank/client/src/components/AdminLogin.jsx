import { useState } from 'react'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import '../pages/pages.css'

// Admin sign-in form, shared by every admin route. On success it hands the
// validated Basic-auth token back to the caller (which stores it via
// useAdminAuth's signIn); this component never touches sessionStorage itself.
function AdminLogin({ onAuthenticated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const token = btoa(`${username}:${password}`)
    try {
      await axios.get('/api/admin/me', { headers: { Authorization: `Basic ${token}` } })
      onAuthenticated(token)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError('Invalid username or password.')
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="page-panel admin-login">
        <header className="preview-header">
          <p className="eyebrow">Admin</p>
          <h1>Sign in</h1>
          <p className="home-lead">Enter your administrator credentials to view study submissions.</p>
        </header>

        <form className="form-card admin-login-card" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            fullWidth
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            fullWidth
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <div className="form-actions">
            <Button type="submit" variant="contained" size="large" className="cta-button" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default AdminLogin
