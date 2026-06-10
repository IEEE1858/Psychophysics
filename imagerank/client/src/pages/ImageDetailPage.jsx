import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import { baseLayout, collectionColor, formatStat } from '../lib/analytics'
import AdminLogin from '../components/AdminLogin'
import PlotlyChart from '../components/PlotlyChart'
import './pages.css'

function formatLevel(level, maxLevel) {
  if (level == null) {
    return '—'
  }
  return maxLevel != null ? `L${level} / ${maxLevel}` : `L${level}`
}

function formatDuration(ms) {
  if (!ms) {
    return '—'
  }
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function StatBlock({ title, stats, color }) {
  return (
    <div className="analytics-statblock" style={{ borderTopColor: color }}>
      <h3>{title}</h3>
      <dl>
        <div><dt>n</dt><dd>{stats?.n ?? 0}</dd></div>
        <div><dt>Min</dt><dd>{formatStat(stats?.min, 0)}</dd></div>
        <div><dt>Max</dt><dd>{formatStat(stats?.max, 0)}</dd></div>
        <div><dt>Mean</dt><dd>{formatStat(stats?.mean)}</dd></div>
        <div><dt>Std dev</dt><dd>{formatStat(stats?.std)}</dd></div>
      </dl>
    </div>
  )
}

function ImageDetailView({ collectionId, imageId }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const { library } = useLibrary()

  useEffect(() => {
    let active = true
    axios
      .get(`/api/admin/images/${encodeURIComponent(collectionId)}/${encodeURIComponent(imageId)}`, {
        headers: authHeader(),
      })
      .then((response) => {
        if (active) {
          setDetail(response.data)
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load image detail.')
        }
      })
    return () => {
      active = false
    }
  }, [collectionId, imageId])

  const image = useMemo(() => {
    const collection = library?.collections?.find((entry) => entry.id === collectionId)
    return collection?.images?.find((entry) => entry.id === imageId) ?? null
  }, [library, collectionId, imageId])

  const rankings = useMemo(() => detail?.rankings ?? [], [detail])
  const accent = collectionColor(collectionId)

  // Histogram of every selected level for this image — favorite vs realism.
  const histData = useMemo(
    () => [
      {
        type: 'histogram',
        name: 'Favorite image',
        x: rankings.map((row) => row.favorite_level).filter((value) => value != null),
        marker: { color: accent },
        opacity: 0.75,
      },
      {
        type: 'histogram',
        name: 'Most realistic',
        x: rankings.map((row) => row.most_realistic_level).filter((value) => value != null),
        marker: { color: '#1d3557' },
        opacity: 0.6,
      },
    ],
    [rankings, accent],
  )

  const histLayout = useMemo(
    () =>
      baseLayout({
        barmode: 'group',
        bargap: 0.12,
        showlegend: true,
        legend: { orientation: 'h', y: 1.15, x: 0 },
        xaxis: { title: 'Selected level', dtick: 1 },
        yaxis: { title: 'Count' },
        margin: { l: 48, r: 12, t: 32, b: 44 },
      }),
    [],
  )

  if (!detail && !error) {
    return (
      <div className="home-status">
        <CircularProgress size={28} />
        <span>Loading image detail…</span>
      </div>
    )
  }

  return (
    <>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {detail ? (
        <>
          <div className="analytics-detail-head">
            <div className="analytics-detail-thumb">
              {image ? (
                <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
              ) : (
                <div className="admin-thumb-missing">no thumbnail</div>
              )}
            </div>
            <div>
              <span className="admin-collection-chip">{collectionId}</span>
              <h2 className="admin-detail-title">{image?.label ?? imageId}</h2>
              <p className="home-lead">
                {detail.count} ranking{detail.count === 1 ? '' : 's'}
                {detail.maxLevel ? ` · max processing level L${detail.maxLevel}` : ''}
              </p>
            </div>
          </div>

          <div className="analytics-statblocks">
            <StatBlock title="Favorite image" stats={detail.favorite} color={accent} />
            <StatBlock title="Most realistic" stats={detail.realism} color="#1d3557" />
          </div>

          <section className="analytics-section">
            <h3 className="admin-detail-subtitle">Distribution of selected levels</h3>
            <div className="analytics-plot-card">
              {rankings.length > 0 ? (
                <PlotlyChart data={histData} layout={histLayout} style={{ height: 320 }} />
              ) : (
                <Alert severity="info">No rankings recorded for this image yet.</Alert>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <h3 className="admin-detail-subtitle">All rankings ({rankings.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="admin-num">Most realistic</th>
                    <th className="admin-num">Favorite image</th>
                    <th className="admin-num">Browsed to</th>
                    <th className="admin-num">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-email">
                        {row.email ?? `Participant ${row.participant_id}`}
                        {row.re_ranked ? <span className="rankings-revised-chip">re-ranked</span> : null}
                      </td>
                      <td className="admin-num">{formatLevel(row.most_realistic_level, row.max_level)}</td>
                      <td className="admin-num">{formatLevel(row.favorite_level, row.max_level)}</td>
                      <td className="admin-num">{formatLevel(row.furthest_visited_level, row.max_level)}</td>
                      <td className="admin-num">{formatDuration(row.grading_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

function ImageDetailPage() {
  const { collectionId, imageId } = useParams()
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
            <p className="eyebrow">Admin · Image analysis</p>
            <h1>{imageId}</h1>
          </div>
          <div className="admin-header-actions">
            <Button component={Link} to="/admin/analytics" variant="outlined" size="small">
              ← Analytics
            </Button>
            <Button onClick={signOut} variant="text" size="small">
              Sign out
            </Button>
          </div>
        </header>

        <ImageDetailView key={`${collectionId}/${imageId}`} collectionId={collectionId} imageId={imageId} />
      </section>
    </main>
  )
}

export default ImageDetailPage
