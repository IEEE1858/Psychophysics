import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import { useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import AdminLogin from '../components/AdminLogin'
import './pages.css'

function formatDuration(ms) {
  if (!ms) {
    return '—'
  }
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function formatAvg(value) {
  return value == null ? '—' : Number(value).toFixed(1)
}

function formatDate(value) {
  if (!value) {
    return '—'
  }
  // Stored as UTC "YYYY-MM-DD HH:MM:SS"; render in the viewer's local time.
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatLevel(level, maxLevel) {
  if (level == null) {
    return '—'
  }
  return maxLevel != null ? `L${level} / ${maxLevel}` : `L${level}`
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
              <td>
                <span className={submission.completed_at ? 'admin-status admin-status-complete' : 'admin-status admin-status-partial'}>
                  {submission.completed_at ? 'Complete' : 'Partial'}
                </span>
              </td>
              <td className="admin-num">{formatDate(submission.started_at)}</td>
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

function SubmissionDetail({ participantId, imageLookup, onBack }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    axios
      .get(`/api/admin/submissions/${participantId}`, { headers: authHeader() })
      .then((response) => {
        if (active) {
          setDetail(response.data)
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load submission detail.')
        }
      })
    return () => {
      active = false
    }
  }, [participantId])

  const loading = detail === null && !error
  const participant = detail?.participant
  const rankings = detail?.rankings ?? []

  return (
    <section className="admin-detail">
      <Button variant="text" onClick={onBack} className="admin-back">
        ← Back to submissions
      </Button>

      {loading ? (
        <div className="home-status">
          <CircularProgress size={28} />
          <span>Loading submission…</span>
        </div>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {participant ? (
        <>
          <h2 className="admin-detail-title">{participant.email ?? `Participant ${participant.id}`}</h2>
          <div className="admin-meta-grid">
            <span><strong>Started:</strong> {formatDate(participant.created_at)}</span>
            <span><strong>Age:</strong> {participant.age ?? '—'}</span>
            <span><strong>Gender:</strong> {participant.gender ?? '—'}</span>
            <span><strong>Describes self:</strong> {participant.self_description ?? '—'}</span>
            <span><strong>Vision:</strong> {participant.vision_status ?? '—'}</span>
            <span><strong>Color blind:</strong> {participant.color_blind ?? '—'}</span>
            <span><strong>Country:</strong> {participant.country_of_origin ?? '—'}</span>
            <span><strong>Display:</strong> {participant.display_type ?? '—'}</span>
            <span><strong>Lighting:</strong> {participant.lighting ?? '—'}</span>
          </div>

          <h3 className="admin-detail-subtitle">Image rankings ({rankings.length})</h3>
          <div className="admin-rankings">
            {rankings.map((ranking) => {
              const image = imageLookup.get(`${ranking.collection_id}:${ranking.image_id}`)
              return (
                <div key={`${ranking.collection_id}:${ranking.image_id}`} className="admin-ranking-card">
                  <div className="admin-ranking-thumb">
                    {image ? (
                      <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
                    ) : (
                      <div className="admin-thumb-missing">no thumbnail</div>
                    )}
                  </div>
                  <div className="admin-ranking-body">
                    <div className="admin-ranking-head">
                      <span className="admin-collection-chip">{ranking.collection_id}</span>
                      <span className="admin-image-name">{image?.label ?? ranking.image_id}</span>
                      {ranking.re_ranked ? <span className="rankings-revised-chip">re-ranked</span> : null}
                    </div>
                    <div className="admin-level-row">
                      <span>Most realistic: <strong>{formatLevel(ranking.most_realistic_level, ranking.max_level)}</strong></span>
                      <span>Favorite: <strong>{formatLevel(ranking.favorite_level, ranking.max_level)}</strong></span>
                      <span>Browsed to: <strong>{formatLevel(ranking.furthest_visited_level, ranking.max_level)}</strong></span>
                      <span>Time: <strong>{formatDuration(ranking.grading_ms)}</strong></span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
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
              <span className="admin-user-date">added {formatDate(user.created_at)}</span>
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
  const [showAdmins, setShowAdmins] = useState(false)
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
            <Button onClick={() => setShowAdmins((value) => !value)} variant="outlined" size="small">
              {showAdmins ? 'View submissions' : 'Manage admins'}
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

        {showAdmins ? (
          <AdminUsersPanel signIn={signIn} />
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
