import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import { baseLayout, collectionColor, formatStat } from '../lib/analytics'
import AdminLogin from '../components/AdminLogin'
import PlotlyChart from '../components/PlotlyChart'
import './pages.css'

// One min/max/mean/std row for a collection's quality or realism selections.
function StatRow({ label, stats }) {
  return (
    <tr>
      <td className="admin-image-name">{label}</td>
      <td className="admin-num">{stats?.n ?? 0}</td>
      <td className="admin-num">{formatStat(stats?.min, 0)}</td>
      <td className="admin-num">{formatStat(stats?.max, 0)}</td>
      <td className="admin-num">{formatStat(stats?.mean)}</td>
      <td className="admin-num">{formatStat(stats?.std)}</td>
    </tr>
  )
}

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
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    axios
      .get('/api/admin/analytics', { headers: authHeader() })
      .then((response) => {
        if (active) {
          setAnalytics(response.data)
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
    return () => {
      active = false
    }
  }, [onSignOut])

  const collections = useMemo(() => analytics?.collections ?? [], [analytics])
  const images = useMemo(() => analytics?.images ?? [], [analytics])

  // Box/whisker plot: one box per collection × selection, over the raw chosen
  // levels. boxmean: 'sd' overlays the mean and standard deviation.
  const boxData = useMemo(
    () =>
      collections.flatMap((collection) => [
        {
          type: 'box',
          name: `${collection.label} · Quality`,
          y: collection.qualityLevels,
          marker: { color: collectionColor(collection.id) },
          boxmean: 'sd',
          boxpoints: 'outliers',
        },
        {
          type: 'box',
          name: `${collection.label} · Realism`,
          y: collection.realismLevels,
          marker: { color: collectionColor(collection.id) },
          fillcolor: 'rgba(0,0,0,0)',
          boxmean: 'sd',
          boxpoints: 'outliers',
        },
      ]),
    [collections],
  )

  const boxLayout = useMemo(
    () =>
      baseLayout({
        showlegend: false,
        yaxis: { title: 'Selected processing level', zeroline: false },
        xaxis: { automargin: true },
      }),
    [],
  )

  // Scatter: one point per image, mean realism (x) vs mean quality (y), as a
  // percentage of each image's max level so the two collections are comparable.
  // customdata carries the route target for the click handler.
  const scatterData = useMemo(
    () =>
      collections.map((collection) => {
        const points = images.filter(
          (image) =>
            image.collectionId === collection.id &&
            image.meanRealismFrac != null &&
            image.meanQualityFrac != null,
        )
        return {
          type: 'scatter',
          mode: 'markers',
          name: collection.label,
          x: points.map((image) => image.meanRealismFrac * 100),
          y: points.map((image) => image.meanQualityFrac * 100),
          customdata: points.map((image) => [image.collectionId, image.imageId, image.n]),
          text: points.map((image) => image.imageId),
          hovertemplate:
            '<b>%{text}</b><br>Realism %{x:.0f}%<br>Quality %{y:.0f}%<br>n = %{customdata[2]}<extra></extra>',
          marker: { color: collectionColor(collection.id), size: 11, opacity: 0.8 },
        }
      }),
    [collections, images],
  )

  const scatterLayout = useMemo(
    () =>
      baseLayout({
        showlegend: true,
        legend: { orientation: 'h', y: 1.12, x: 0 },
        xaxis: { title: 'Mean most-realistic level (% of max)', range: [-5, 105], zeroline: false },
        yaxis: { title: 'Mean highest-quality level (% of max)', range: [-5, 105], zeroline: false },
        margin: { l: 60, r: 16, t: 32, b: 52 },
      }),
    [],
  )

  const handleScatterClick = useCallback(
    (point) => {
      const target = point?.customdata
      if (Array.isArray(target) && target[0] && target[1]) {
        navigate(`/admin/images/${encodeURIComponent(target[0])}/${encodeURIComponent(target[1])}`)
      }
    },
    [navigate],
  )

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
          <div className="analytics-cards">
            <StatCard
              label="Subjects"
              value={analytics.participants.total}
              sub={`${analytics.participants.completed} completed`}
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
            <h2 className="admin-detail-subtitle">Summary statistics</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Selection</th>
                    <th className="admin-num">n</th>
                    <th className="admin-num">Min</th>
                    <th className="admin-num">Max</th>
                    <th className="admin-num">Mean</th>
                    <th className="admin-num">Std dev</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((collection) => [
                    <StatRow
                      key={`${collection.id}-q`}
                      label={`${collection.label} · Highest quality`}
                      stats={collection.quality}
                    />,
                    <StatRow
                      key={`${collection.id}-r`}
                      label={`${collection.label} · Most realistic`}
                      stats={collection.realism}
                    />,
                  ])}
                </tbody>
              </table>
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Realism vs. quality by image</h2>
            <p className="home-lead analytics-hint">
              Each point is one image, positioned by its mean selected level (as a percentage of that
              image&apos;s maximum processing). Click a point to open its detail page.
            </p>
            <div className="analytics-plot-card">
              {images.length > 0 ? (
                <PlotlyChart
                  data={scatterData}
                  layout={scatterLayout}
                  onPointClick={handleScatterClick}
                  style={{ height: 460, cursor: 'pointer' }}
                />
              ) : (
                <Alert severity="info">No ranking data yet.</Alert>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Distribution of selected levels</h2>
            <div className="analytics-plot-card">
              {boxData.some((trace) => trace.y.length > 0) ? (
                <PlotlyChart data={boxData} layout={boxLayout} style={{ height: 420 }} />
              ) : (
                <Alert severity="info">No ranking data yet.</Alert>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Histograms by selection</h2>
            <div className="analytics-histogram-grid">
              {collections.map((collection) => {
                const histData = [
                  {
                    type: 'histogram',
                    name: 'Highest quality',
                    x: collection.qualityLevels,
                    marker: { color: collectionColor(collection.id) },
                    opacity: 0.75,
                  },
                  {
                    type: 'histogram',
                    name: 'Most realistic',
                    x: collection.realismLevels,
                    marker: { color: '#1d3557' },
                    opacity: 0.6,
                  },
                ]
                const histLayout = baseLayout({
                  barmode: 'group',
                  bargap: 0.12,
                  showlegend: true,
                  legend: { orientation: 'h', y: 1.15, x: 0 },
                  xaxis: { title: `${collection.label} — selected level`, dtick: 1 },
                  yaxis: { title: 'Count' },
                  margin: { l: 48, r: 12, t: 32, b: 44 },
                })
                return (
                  <div key={collection.id} className="analytics-plot-card">
                    {collection.qualityLevels.length + collection.realismLevels.length > 0 ? (
                      <PlotlyChart data={histData} layout={histLayout} style={{ height: 300 }} />
                    ) : (
                      <Alert severity="info">No {collection.label} data yet.</Alert>
                    )}
                  </div>
                )
              })}
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
