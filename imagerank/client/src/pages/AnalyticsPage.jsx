import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import { DEMOGRAPHIC_DIMENSIONS, emptyFilterOptions, useAnalyticsFilters } from '../lib/analytics'
import { AnalyticsFilterBar } from '../components/AnalyticsFilters'
import AdminLogin from '../components/AdminLogin'
import './pages.css'

function StatCard({ label, value, sub }) {
  return (
    <div className="analytics-stat-card">
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-label">{label}</span>
      {sub ? <span className="analytics-stat-sub">{sub}</span> : null}
    </div>
  )
}

function AnalyticsView({ onSignOut }) {
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')
  // The key of the query whose response is currently on screen. Set only when a
  // request settles, so "refreshing" can be derived below rather than assigned from
  // inside the effect (react-hooks/set-state-in-effect).
  const [loadedParamsKey, setLoadedParamsKey] = useState(null)
  const { filters, setFilters, queryParams, paramsKey, hasActiveFilters } = useAnalyticsFilters()

  // Derived, not stored: a request is outstanding whenever the params on screen are
  // not the params we last loaded. This also makes the spinner appear in the same
  // render as the filter change, rather than one render later.
  const refreshing = loadedParamsKey !== paramsKey

  useEffect(() => {
    let active = true
    axios
      .get('/api/admin/analytics', { headers: authHeader(), params: queryParams })
      .then((response) => {
        if (active) {
          setAnalytics(response.data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!active) {
          return
        }
        if (requestError.response?.status === 401) {
          onSignOut()
        }
        setError('Failed to load analytics.')
      })
      .finally(() => {
        // Skipped when superseded: a newer request is in flight and will record its
        // own key, so the spinner correctly stays up until that one settles.
        if (active) {
          setLoadedParamsKey(paramsKey)
        }
      })
    return () => {
      active = false
    }
  }, [onSignOut, paramsKey, queryParams])

  // Memoized for the same reason as collections below: the ?? fallback allocates a
  // new object every render, so anything depending on its identity would recompute
  // each time.
  const filterOptions = useMemo(() => analytics?.filterOptions ?? emptyFilterOptions(), [analytics])
  const collections = useMemo(() => analytics?.collections ?? [], [analytics])

  if (!analytics && !error) {
    return (
      <div className="home-status">
        <CircularProgress size={28} />
        <span>Loading analytics…</span>
      </div>
    )
  }

  return (
    <>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {analytics ? (
        <>
          <AnalyticsFilterBar
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            refreshing={refreshing}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="analytics-cards">
            <StatCard
              label="Subjects"
              value={hasActiveFilters ? analytics.participants.filtered : analytics.participants.total}
              sub={
                hasActiveFilters
                  ? `of ${analytics.participants.total} total`
                  : `${analytics.participants.completed} completed`
              }
            />
            {collections.map((collection) => (
              <StatCard
                key={collection.id}
                label={`${collection.label} ranked`}
                value={collection.rankedCount}
                sub={`${collection.uniqueImages} images`}
              />
            ))}
          </div>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Demographic breakdowns</h2>
            <p className="home-lead analytics-hint">
              Favorite/realism stats, distributions, and per-image detail broken down by one demographic
              or condition at a time (including imaging expertise), for the filtered slice above.
            </p>
            <div className="analytics-dimension-grid">
              {DEMOGRAPHIC_DIMENSIONS.map((dimension) => (
                <Link
                  key={dimension.slug}
                  className="analytics-dimension-link"
                  to={`/admin/analytics/${dimension.slug}`}
                >
                  {dimension.label}
                </Link>
              ))}
            </div>
          </section>

          <p className="analytics-generated">
            Generated {new Date(analytics.generatedAt).toLocaleString()}
          </p>
        </>
      ) : null}
    </>
  )
}

function AnalyticsPage() {
  const { authed, checking, signIn, signOut } = useAdminAuth()

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
            <h1>Study analytics</h1>
          </div>
          <div className="admin-header-actions">
            <Button component={Link} to="/admin" variant="outlined" size="small">
              Submissions
            </Button>
            <Button component={Link} to="/" variant="outlined" size="small">
              Home
            </Button>
            <Button onClick={signOut} variant="text" size="small">
              Sign out
            </Button>
          </div>
        </header>

        <AnalyticsView onSignOut={signOut} />
      </section>
    </main>
  )
}

export default AnalyticsPage
