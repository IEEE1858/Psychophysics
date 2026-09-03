import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import {
  baseLayout,
  collectionColor,
  formatDuration,
  formatLevel,
  formatStat,
  subjectEmail,
  subjectLabel,
} from '../lib/analytics'
import AdminLogin from '../components/AdminLogin'
import PlotlyChart from '../components/PlotlyChart'
import './pages.css'

const REALISM_COLOR = '#1d3557'

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
  // The viewer opens on the unprocessed image and follows histogram clicks.
  const [viewLevel, setViewLevel] = useState(0)
  // Set only by clicking a histogram bar, so the initial level-0 view does not
  // highlight anyone until the reader actually picks a level.
  const [highlightLevel, setHighlightLevel] = useState(null)
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
  const variants = useMemo(() => image?.variants ?? [], [image])
  const accent = collectionColor(collectionId)
  const maxLevel = detail?.maxLevel || image?.maxLevel || 0

  // Every level that exists for this image, whether or not anyone chose it, so
  // the histogram shows the empty levels too (issue #59). Falls back to
  // 0..maxLevel when the library has not loaded, and absorbs any recorded level
  // outside the variant list rather than dropping it.
  const levelDomain = useMemo(() => {
    const levels = new Set(
      variants.length > 0
        ? variants.map((variant) => variant.level)
        : Array.from({ length: maxLevel + 1 }, (_, index) => index),
    )
    for (const row of rankings) {
      if (row.favorite_level != null) levels.add(row.favorite_level)
      if (row.most_realistic_level != null) levels.add(row.most_realistic_level)
    }
    return [...levels].sort((left, right) => left - right)
  }, [variants, maxLevel, rankings])

  // Clamp without an effect: if the chosen level is not in the domain (still
  // loading, or a stale click), fall back to the first level.
  const effectiveLevel = levelDomain.includes(viewLevel) ? viewLevel : (levelDomain[0] ?? 0)
  const currentVariant =
    variants.find((variant) => variant.level === effectiveLevel) ?? variants[0] ?? null

  const counts = useMemo(() => {
    const favorite = new Map(levelDomain.map((level) => [level, 0]))
    const realism = new Map(levelDomain.map((level) => [level, 0]))
    for (const row of rankings) {
      if (row.favorite_level != null) {
        favorite.set(row.favorite_level, (favorite.get(row.favorite_level) ?? 0) + 1)
      }
      if (row.most_realistic_level != null) {
        realism.set(row.most_realistic_level, (realism.get(row.most_realistic_level) ?? 0) + 1)
      }
    }
    return {
      favorite: levelDomain.map((level) => favorite.get(level) ?? 0),
      realism: levelDomain.map((level) => realism.get(level) ?? 0),
    }
  }, [levelDomain, rankings])

  // Explicit bars rather than Plotly's own binning: that is what keeps the
  // zero-count levels on the axis.
  const histData = useMemo(
    () => [
      {
        type: 'bar',
        name: 'Favorite image',
        x: levelDomain,
        y: counts.favorite,
        marker: { color: accent },
        hovertemplate: 'L%{x}<br>%{y} chose it as favorite<extra></extra>',
      },
      {
        type: 'bar',
        name: 'Most realistic',
        x: levelDomain,
        y: counts.realism,
        marker: { color: REALISM_COLOR },
        hovertemplate: 'L%{x}<br>%{y} chose it as most realistic<extra></extra>',
      },
    ],
    [levelDomain, counts, accent],
  )

  const histLayout = useMemo(
    () =>
      baseLayout({
        barmode: 'group',
        bargap: 0.18,
        showlegend: true,
        legend: { orientation: 'h', y: 1.16, x: 0 },
        xaxis: { title: 'Processing level', dtick: 1, range: [-0.6, (levelDomain.at(-1) ?? 0) + 0.6] },
        yaxis: { title: 'Number of subjects', dtick: 1, rangemode: 'tozero' },
        margin: { l: 56, r: 12, t: 36, b: 48 },
      }),
    [levelDomain],
  )

  // Clicking a bar flips the viewer to that level and highlights the subjects
  // who chose it in the table below.
  const handleHistClick = useCallback((point) => {
    const level = Number(point?.x)
    if (Number.isFinite(level)) {
      setViewLevel(level)
      setHighlightLevel(level)
    }
  }, [])

  // Does processing preference shift with age? One point per subject, per
  // selection.
  const ageData = useMemo(() => {
    const series = (key, name, color) => {
      const points = rankings.filter((row) => row.age != null && row[key] != null)
      return {
        type: 'scatter',
        mode: 'markers',
        name,
        x: points.map((row) => Number(row.age)),
        y: points.map((row) => row[key]),
        text: points.map((row) => subjectLabel(row)),
        hovertemplate: '<b>%{text}</b><br>Age %{x}<br>L%{y}<extra></extra>',
        marker: { color, size: 11, opacity: 0.78 },
      }
    }
    return [
      series('favorite_level', 'Favorite image', accent),
      series('most_realistic_level', 'Most realistic', REALISM_COLOR),
    ]
  }, [rankings, accent])

  const ageLayout = useMemo(
    () =>
      baseLayout({
        showlegend: true,
        legend: { orientation: 'h', y: 1.16, x: 0 },
        xaxis: { title: 'Subject age (years)', zeroline: false },
        yaxis: { title: 'Selected processing level', dtick: 1, rangemode: 'tozero' },
        margin: { l: 56, r: 12, t: 36, b: 52 },
      }),
    [],
  )

  const agePointCount = ageData.reduce((total, trace) => total + trace.x.length, 0)

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
                {maxLevel ? ` · max processing level L${maxLevel}` : ''}
              </p>
            </div>
          </div>

          <section className="analytics-section">
            <h3 className="admin-detail-subtitle">Image at each processing level</h3>
            <div className="image-viewer-card">
              {currentVariant ? (
                <img
                  className="image-viewer-frame"
                  src={currentVariant.url}
                  alt={`${image?.label ?? imageId} at level ${effectiveLevel}`}
                />
              ) : (
                <Alert severity="info">
                  {library ? 'No image variants found for this image.' : 'Loading image variants…'}
                </Alert>
              )}
              <div className="image-viewer-controls">
                <Slider
                  value={effectiveLevel}
                  min={levelDomain[0] ?? 0}
                  max={levelDomain.at(-1) ?? 0}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_event, value) => setViewLevel(Number(value))}
                  aria-label="Processing level"
                  disabled={levelDomain.length < 2}
                />
                <p className="image-viewer-caption">
                  <strong>{formatLevel(effectiveLevel, maxLevel)}</strong>
                  {effectiveLevel === 0 ? ' · unprocessed original' : ''}
                  {currentVariant?.description ? ` · ${currentVariant.description}` : ''}
                </p>
              </div>
            </div>
          </section>

          <div className="analytics-statblocks">
            <StatBlock title="Favorite image" stats={detail.favorite} color={accent} />
            <StatBlock title="Most realistic" stats={detail.realism} color={REALISM_COLOR} />
          </div>

          <section className="analytics-section">
            <h3 className="admin-detail-subtitle">Distribution of selected levels</h3>
            <p className="home-lead analytics-table-lead">
              Every level this image was processed to, including the ones nobody picked. Click a bar to
              show that level above and highlight the subjects who chose it.
            </p>
            <div className="analytics-plot-card">
              {rankings.length > 0 ? (
                <PlotlyChart
                  data={histData}
                  layout={histLayout}
                  onPointClick={handleHistClick}
                  style={{ height: 340 }}
                />
              ) : (
                <Alert severity="info">No rankings recorded for this image yet.</Alert>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <h3 className="admin-detail-subtitle">Processing preference by subject age</h3>
            <div className="analytics-plot-card">
              {agePointCount > 0 ? (
                <PlotlyChart data={ageData} layout={ageLayout} style={{ height: 340 }} />
              ) : (
                <Alert severity="info">No subject ages recorded for this image yet.</Alert>
              )}
            </div>
          </section>

          <section className="analytics-section">
            <div className="analytics-rankings-head">
              <h3 className="admin-detail-subtitle">All rankings ({rankings.length})</h3>
              {highlightLevel != null ? (
                <Chip
                  label={`Highlighting L${highlightLevel}`}
                  onDelete={() => setHighlightLevel(null)}
                  size="small"
                />
              ) : null}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="admin-num">Age</th>
                    <th className="admin-num">Most realistic</th>
                    <th className="admin-num">Favorite image</th>
                    <th className="admin-num">Browsed to</th>
                    <th className="admin-num">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row) => {
                    const highlighted =
                      highlightLevel != null &&
                      (row.favorite_level === highlightLevel || row.most_realistic_level === highlightLevel)
                    return (
                      <tr key={row.id} className={highlighted ? 'analytics-row-highlight' : undefined}>
                        <td className="admin-email">
                          <Link className="analytics-image-link" to={`/admin/subjects/${row.participant_id}`}>
                            {subjectLabel(row)}
                          </Link>
                          {subjectEmail(row) ? null : (
                            <span className="analytics-guest-ip">{row.ip_address ?? 'no IP recorded'}</span>
                          )}
                          {row.re_ranked ? <span className="rankings-revised-chip">re-ranked</span> : null}
                        </td>
                        <td className="admin-num">{row.age ?? '—'}</td>
                        <td className="admin-num">{formatLevel(row.most_realistic_level, row.max_level)}</td>
                        <td className="admin-num">{formatLevel(row.favorite_level, row.max_level)}</td>
                        <td className="admin-num">{formatLevel(row.furthest_visited_level, row.max_level)}</td>
                        <td className="admin-num">{formatDuration(row.grading_ms)}</td>
                      </tr>
                    )
                  })}
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
