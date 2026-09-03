import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import { useLibrary } from '../lib/useLibrary'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import AdminLogin from '../components/AdminLogin'
import SubmissionDetail from '../components/SubmissionDetail'
import { formatDateTime, formatDuration } from '../lib/analytics'
import './pages.css'

function formatAvg(value) {
  return value == null ? '—' : Number(value).toFixed(1)
}

function SubmissionsTable({ submissions, onSelect }) {
  if (submissions.length === 0) {
    return <Alert severity="info">No submissions yet.</Alert>
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th rowSpan={2}>Email</th>
            <th rowSpan={2}>Address</th>
            <th rowSpan={2}>Status</th>
            <th rowSpan={2}>Started</th>
            <th rowSpan={2}>Total time</th>
            <th colSpan={3} className="admin-group admin-group-start">Sharpness</th>
            <th colSpan={3} className="admin-group admin-group-start">HDR</th>
          </tr>
          <tr>
            <th className="admin-num admin-group-start">Ranked</th>
            <th className="admin-num">Favorite</th>
            <th className="admin-num">Realism</th>
            <th className="admin-num admin-group-start">Ranked</th>
            <th className="admin-num">Favorite</th>
            <th className="admin-num">Realism</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id} className="admin-row" onClick={() => onSelect(submission.id)}>
              <td className="admin-email">{submission.email ?? '—'}</td>
              <td className="admin-email">{submission.ip_address ?? '—'}</td>
              <td>
                <span className={submission.completed_at ? 'admin-status admin-status-complete' : 'admin-status admin-status-partial'}>
                  {submission.completed_at ? 'Complete' : 'Partial'}
                </span>
              </td>
              <td className="admin-num">{formatDateTime(submission.started_at)}</td>
              <td className="admin-num">{formatDuration(submission.total_test_time_ms)}</td>
              <td className="admin-num admin-group-start">{submission.sharpness_count}</td>
              <td className="admin-num">{formatAvg(submission.sharpness_favorite_avg)}</td>
              <td className="admin-num">{formatAvg(submission.sharpness_realism_avg)}</td>
              <td className="admin-num admin-group-start">{submission.hdr_count}</td>
              <td className="admin-num">{formatAvg(submission.hdr_favorite_avg)}</td>
              <td className="admin-num">{formatAvg(submission.hdr_realism_avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Participants who agreed to be contacted — about the results of this study, or
// about taking part in future ones (issue #45) — with a CSV download per list
// for whatever mailing tool the group uses. The routes are admin-only, so the
// CSV is fetched with the Basic token and handed to the browser as a blob
// rather than linked directly.
const CONTACT_DOWNLOADS = [
  { interest: 'results', label: 'Results CSV' },
  { interest: 'future', label: 'Future studies CSV' },
  { interest: 'all', label: 'All contacts CSV' },
]

function ContactListPanel() {
  const [contacts, setContacts] = useState(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let active = true
    axios
      .get('/api/admin/contact-list', { headers: authHeader() })
      .then((response) => {
        if (active) {
          setContacts(response.data.contacts)
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load the contact list.')
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function downloadCsv(interest) {
    setDownloading(interest)
    setError('')
    try {
      const response = await axios.get(`/api/admin/contact-list.csv?interest=${interest}`, {
        headers: authHeader(),
        responseType: 'blob',
      })
      const href = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = href
      link.download = `imagerank-contacts-${interest}.csv`
      link.click()
      URL.revokeObjectURL(href)
    } catch {
      setError('Failed to download the CSV.')
    } finally {
      setDownloading('')
    }
  }

  const loading = contacts === null && !error
  const resultsCount = (contacts ?? []).filter((contact) => contact.results_opt_in).length
  const futureCount = (contacts ?? []).filter((contact) => contact.future_studies_opt_in).length

  return (
    <section className="admin-results-panel">
      <div className="admin-results-head">
        <div>
          <h2 className="admin-detail-title">Contact list</h2>
          <p className="admin-results-sub">
            {contacts
              ? `${resultsCount} to notify about the results, ${futureCount} open to future studies.`
              : '—'}
          </p>
        </div>
        <div className="admin-header-actions">
          {CONTACT_DOWNLOADS.map(({ interest, label }) => (
            <Button
              key={interest}
              variant={interest === 'all' ? 'outlined' : 'contained'}
              size="small"
              onClick={() => downloadCsv(interest)}
              disabled={Boolean(downloading) || !contacts?.length}
            >
              {downloading === interest ? 'Preparing…' : label}
            </Button>
          ))}
        </div>
      </div>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <div className="home-status">
          <CircularProgress size={24} />
          <span>Loading contact list…</span>
        </div>
      ) : null}

      {contacts?.length === 0 ? (
        <Alert severity="info">Nobody has asked to be contacted yet.</Alert>
      ) : null}

      {contacts?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th className="admin-num">Results</th>
                <th className="admin-num">Future studies</th>
                <th className="admin-num">Sessions</th>
                <th className="admin-num">Completed</th>
                <th className="admin-num">Opted in</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.email}>
                  <td className="admin-email">{contact.email}</td>
                  <td className="admin-num">{contact.results_opt_in ? '✓' : '—'}</td>
                  <td className="admin-num">{contact.future_studies_opt_in ? '✓' : '—'}</td>
                  <td className="admin-num">{contact.sessions}</td>
                  <td className="admin-num">{contact.completed_sessions}</td>
                  <td className="admin-num">{formatDateTime(contact.last_opted_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function AdminUsersPanel({ signIn }) {
  const [users, setUsers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  // "Change your own password" form state.
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwSubmitting, setPwSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    axios
      .get('/api/admin/users', { headers: authHeader() })
      .then((response) => {
        if (active) {
          setUsers(response.data.users)
        }
      })
      .catch(() => {
        if (active) {
          setLoadError('Failed to load admin users.')
        }
      })
    return () => {
      active = false
    }
  }, [reloadToken])

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setSuccess('')

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      await axios.post('/api/admin/users', { username, password }, { headers: authHeader() })
      setSuccess(`Admin “${username.trim()}” created.`)
      setUsername('')
      setPassword('')
      setReloadToken((token) => token + 1)
    } catch (requestError) {
      setFormError(requestError.response?.data?.error ?? 'Failed to create admin user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }

    setPwSubmitting(true)
    try {
      const response = await axios.post(
        '/api/admin/change-password',
        { newPassword },
        { headers: authHeader() },
      )
      // The server verified the *current* password (Basic auth) and returns the
      // username; refresh the stored Basic token so the session keeps working
      // with the new password instead of 401-ing on the next request.
      signIn(btoa(`${response.data.username}:${newPassword}`))
      setPwSuccess('Your password has been changed.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      setPwError(requestError.response?.data?.error ?? 'Failed to change password.')
    } finally {
      setPwSubmitting(false)
    }
  }

  const loadingUsers = users === null && !loadError

  return (
    <section className="admin-users-panel">
      <h2 className="admin-detail-title">Admin users</h2>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      {loadingUsers ? (
        <div className="home-status">
          <CircularProgress size={24} />
          <span>Loading admins…</span>
        </div>
      ) : (
        <ul className="admin-users-list">
          {(users ?? []).map((user) => (
            <li key={user.id}>
              <span className="admin-user-name">{user.username}</span>
              <span className="admin-user-date">added {formatDateTime(user.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="admin-add-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="New username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          size="small"
        />
        <TextField
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          size="small"
          helperText="At least 8 characters"
        />
        <Button type="submit" variant="contained" disabled={submitting || !username.trim() || !password}>
          {submitting ? 'Adding…' : 'Add admin'}
        </Button>
      </form>

      {formError ? <Alert severity="error">{formError}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <h2 className="admin-detail-title admin-change-pw-title">Change your password</h2>
      <form className="admin-add-form" onSubmit={handleChangePassword} noValidate>
        <TextField
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          size="small"
          autoComplete="new-password"
          helperText="At least 8 characters"
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          size="small"
          autoComplete="new-password"
        />
        <Button type="submit" variant="contained" disabled={pwSubmitting || !newPassword || !confirmPassword}>
          {pwSubmitting ? 'Changing…' : 'Change password'}
        </Button>
      </form>

      {pwError ? <Alert severity="error">{pwError}</Alert> : null}
      {pwSuccess ? <Alert severity="success">{pwSuccess}</Alert> : null}
    </section>
  )
}

function AdminPage() {
  const { authed, checking, signIn, signOut } = useAdminAuth()
  const [submissions, setSubmissions] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  // Which panel the dashboard is showing: the submissions table (with its
  // drill-down), the results mailing list, or admin-user management.
  const [view, setView] = useState('submissions')
  const { library } = useLibrary()

  // Map "collectionId:imageId" -> image, for resolving thumbnails and names.
  const imageLookup = useMemo(() => {
    const lookup = new Map()
    for (const collection of library?.collections ?? []) {
      for (const image of collection.images) {
        lookup.set(`${collection.id}:${image.id}`, image)
      }
    }
    return lookup
  }, [library])

  // Load submissions once authenticated.
  useEffect(() => {
    if (!authed) {
      return undefined
    }
    let active = true
    axios
      .get('/api/admin/submissions', { headers: authHeader() })
      .then((response) => {
        if (active) {
          setSubmissions(response.data.submissions)
        }
      })
      .catch((requestError) => {
        if (!active) {
          return
        }
        if (requestError.response?.status === 401) {
          signOut()
        }
        setError('Failed to load submissions.')
      })
    return () => {
      active = false
    }
  }, [authed, signOut])

  const loading = authed && submissions === null && !error

  function handleSignOut() {
    signOut()
    setSubmissions(null)
    setSelectedId(null)
    setError('')
  }

  if (checking) {
    return (
      <main className="page-shell">
        <section className="page-panel">
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading…</span>
          </div>
        </section>
      </main>
    )
  }

  if (!authed) {
    return <AdminLogin onAuthenticated={signIn} />
  }

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header admin-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Study submissions</h1>
          </div>
          <div className="admin-header-actions">
            <Button component={Link} to="/admin/analytics" variant="contained" size="small">
              Analytics
            </Button>
            <Button
              onClick={() => setView((current) => (current === 'contacts' ? 'submissions' : 'contacts'))}
              variant="outlined"
              size="small"
            >
              {view === 'contacts' ? 'View submissions' : 'Contact list'}
            </Button>
            <Button
              onClick={() => setView((current) => (current === 'admins' ? 'submissions' : 'admins'))}
              variant="outlined"
              size="small"
            >
              {view === 'admins' ? 'View submissions' : 'Manage admins'}
            </Button>
            <Button component={Link} to="/" variant="outlined" size="small">
              Home
            </Button>
            <Button onClick={handleSignOut} variant="text" size="small">
              Sign out
            </Button>
          </div>
        </header>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {view === 'admins' ? (
          <AdminUsersPanel signIn={signIn} />
        ) : view === 'contacts' ? (
          <ContactListPanel />
        ) : selectedId != null ? (
          <SubmissionDetail
            key={selectedId}
            participantId={selectedId}
            imageLookup={imageLookup}
            onBack={() => setSelectedId(null)}
          />
        ) : loading ? (
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading submissions…</span>
          </div>
        ) : (
          <SubmissionsTable submissions={submissions ?? []} onSelect={setSelectedId} />
        )}
      </section>
    </main>
  )
}

export default AdminPage
