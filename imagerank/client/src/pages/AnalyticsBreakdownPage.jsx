import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import {
  DEMOGRAPHIC_DIMENSIONS,
  baseLayout,
  emptyFilterOptions,
  formatStat,
  groupColor,
  useAnalyticsFilters,
} from '../lib/analytics'
import { AnalyticsFilterBar } from '../components/AnalyticsFilters'
import AdminLogin from '../components/AdminLogin'
import ImageStatsTable from '../components/ImageStatsTable'
import PlotlyChart from '../components/PlotlyChart'
import './pages.css'

// One demographic dimension (gender, lighting, display, country, imaging
// expertise, color blindness, vision degradation), broken into its distinct
// values — the single-variable generalization of the "Expert vs. layperson"
// section on the main analytics page. A second dimension for cross-tab
// comparison is a planned follow-up (issue: demographic breakdown pages).

function StatCard({ label, value, sub }) {
  return (
    <div className="analytics-stat-card">
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-label">{label}</span>
      {sub ? <span className="analytics-stat-sub">{sub}</span> : null}
    </div>
  )
}

// One min/max/mean/std row for a group's favorite or realism selections
// within a single collection.
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

function BreakdownView({ dimensionSlug, dimensionLabel, onSignOut }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loadedKey, setLoadedKey] = useState(null)
  const { filters, setFilters, queryParams, paramsKey, hasActiveFilters } = useAnalyticsFilters()

  const requestKey = `${dimensionSlug}:${paramsKey}`
  const refreshing = loadedKey !== requestKey

  useEffect(() => {
    let active = true
    axios
      .get(`/api/admin/analytics/breakdown/${dimensionSlug}`, { headers: authHeader(), params: queryParams })
      .then((response) => {
        if (active) {
          setData(response.data)
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
        setError('Failed to load this breakdown.')
      })
      .finally(() => {
        if (active) {
          setLoadedKey(requestKey)
        }
      })
    return () => {
      active = false
    }
  }, [dimensionSlug, onSignOut, queryParams, requestKey])

  const filterOptions = useMemo(() => data?.filterOptions ?? emptyFilterOptions(), [data])
  const groups = useMemo(() => data?.breakdown?.groups ?? [], [data])

  // One small box plot per collection (Sharpness, HDR), each with one trace
  // per group value (e.g. Female / Male / Non-binary for gender) so the
  // groups sit side by side within that collection (boxmode = 'group'). The
  // set of collections is read off the first group since every group always
  // carries the same fixed COLLECTIONS list from the server, just with
  // different (possibly empty) data.
  const collectionMeta = useMemo(
    () => (groups[0]?.collections ?? []).map((collection) => ({ id: collection.id, label: collection.label })),
    [groups],
  )

  const collectionBoxCharts = useMemo(
    () =>
      collectionMeta.map(({ id, label }) => ({
        id,
        label,
        data: groups.map((group, index) => {
          const collection = group.collections.find((entry) => entry.id === id)
          const x = []
          const y = []
          collection?.favoriteLevels.forEach((level) => {
            x.push('Favorite')
            y.push(level)
          })
          collection?.realismLevels.forEach((level) => {
            x.push('Realism')
            y.push(level)
          })
          return {
            type: 'box',
            name: group.label,
            x,
            y,
            marker: { color: groupColor(group.key, index) },
            boxmean: 'sd',
            boxpoints: 'outliers',
          }
        }),
      })),
    [collectionMeta, groups],
  )

  const collectionBoxLayout = useMemo(
    () =>
      baseLayout({
        boxmode: 'group',
        showlegend: true,
        legend: { orientation: 'h', y: 1.16, x: 0 },
        yaxis: { title: 'Selected level', zeroline: false },
        xaxis: { automargin: true },
        margin: { l: 48, r: 12, t: 32, b: 44 },
      }),
    [],
  )

  // One scatter per collection, each a mean-realism-vs-mean-favorite plot
  // with one trace per group value, colored to match the box plot above.
  // customdata carries the route target for the click handler.
  const collectionScatterCharts = useMemo(
    () =>
      collectionMeta.map(({ id, label }) => ({
        id,
        label,
        data: groups.map((group, index) => {
          const points = group.images.filter(
            (image) =>
              image.collectionId === id && image.meanRealismFrac != null && image.meanFavoriteFrac != null,
          )
          return {
            type: 'scatter',
            mode: 'markers',
            name: group.label,
            x: points.map((image) => image.meanRealismFrac * 100),
            y: points.map((image) => image.meanFavoriteFrac * 100),
            customdata: points.map((image) => [image.collectionId, image.imageId, image.n]),
            text: points.map((image) => image.imageId),
            hovertemplate:
              '<b>%{text}</b><br>Realism %{x:.0f}%<br>Favorite %{y:.0f}%<br>n = %{customdata[2]}<extra></extra>',
            marker: { color: groupColor(group.key, index), size: 10, opacity: 0.8 },
          }
        }),
      })),
    [collectionMeta, groups],
  )

  const collectionScatterLayout = useMemo(
    () =>
      baseLayout({
        showlegend: true,
        legend: { orientation: 'h', y: 1.16, x: 0 },
        xaxis: { title: 'Mean realism (% of max)', range: [-5, 105], zeroline: false },
        yaxis: { title: 'Mean favorite (% of max)', range: [-5, 105], zeroline: false },
        margin: { l: 48, r: 12, t: 32, b: 44 },
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

  // One histogram card per collection, each with one trace per group value —
  // split into a Favorite-image grid and a Most-realistic grid, since a
  // histogram's x-axis is the level itself and can't also carry the
  // Favorite/Realism split the way the box plot's x categories do.
  const collectionHistCharts = useMemo(
    () =>
      collectionMeta.map(({ id, label }) => ({
        id,
        label,
        favorite: groups.map((group, index) => {
          const collection = group.collections.find((entry) => entry.id === id)
          return {
            type: 'histogram',
            name: group.label,
            x: collection?.favoriteLevels ?? [],
            marker: { color: groupColor(group.key, index) },
            opacity: 0.7,
          }
        }),
        realism: groups.map((group, index) => {
          const collection = group.collections.find((entry) => entry.id === id)
          return {
            type: 'histogram',
            name: group.label,
            x: collection?.realismLevels ?? [],
            marker: { color: groupColor(group.key, index) },
            opacity: 0.7,
          }
        }),
      })),
    [collectionMeta, groups],
  )

  const histLayout = useMemo(
    () =>
      baseLayout({
        barmode: 'group',
        bargap: 0.12,
        showlegend: true,
        legend: { orientation: 'h', y: 1.16, x: 0 },
        xaxis: { title: 'Selected level', dtick: 1 },
        yaxis: { title: 'Count' },
        margin: { l: 48, r: 12, t: 32, b: 44 },
      }),
    [],
  )

  if (!data && !error) {
    return (
      <div className="home-status">
        <CircularProgress size={28} />
        <span>Loading…</span>
      </div>
    )
  }

  return (
    <>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {data ? (
        <>
          <AnalyticsFilterBar
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            refreshing={refreshing}
            hasActiveFilters={hasActiveFilters}
            dimensionKey={dimensionSlug}
          />

          <div className="analytics-cards">
            <StatCard
              label="Subjects"
              value={hasActiveFilters ? data.participants.filtered : data.participants.total}
              sub={hasActiveFilters ? `of ${data.participants.total} total` : `${data.participants.completed} completed`}
            />
            {groups.map((group) => (
              <StatCard key={group.key} label={group.label} value={group.n} sub="participants" />
            ))}
          </div>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Distribution of selected levels, by {dimensionLabel.toLowerCase()}</h2>
            <div className="analytics-histogram-grid">
              {collectionBoxCharts.map((chart) => (
                <div key={chart.id} className="analytics-plot-card">
                  <h3 className="analytics-plot-title">{chart.label}</h3>
                  {chart.data.some((trace) => trace.y.length > 0) ? (
                    <PlotlyChart data={chart.data} layout={collectionBoxLayout} style={{ height: 360 }} />
                  ) : (
                    <Alert severity="info">No ranking data for this filter.</Alert>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Realism vs. favorite by image, by {dimensionLabel.toLowerCase()}</h2>
            <p className="home-lead analytics-hint">
              Each point is one image, positioned by its mean selected level (as a percentage of that
              image&apos;s maximum processing). Click a point to open its detail page.
            </p>
            <div className="analytics-histogram-grid">
              {collectionScatterCharts.map((chart) => (
                <div key={chart.id} className="analytics-plot-card">
                  <h3 className="analytics-plot-title">{chart.label}</h3>
                  {chart.data.some((trace) => trace.x.length > 0) ? (
                    <PlotlyChart
                      data={chart.data}
                      layout={collectionScatterLayout}
                      onPointClick={handleScatterClick}
                      style={{ height: 360, cursor: 'pointer' }}
                    />
                  ) : (
                    <Alert severity="info">No ranking data for this filter.</Alert>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Summary statistics</h2>
            {groups.length === 0 ? (
              <Alert severity="info">No {dimensionLabel.toLowerCase()} data for this filter.</Alert>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{dimensionLabel} · Selection</th>
                      <th className="admin-num">n</th>
                      <th className="admin-num">Min</th>
                      <th className="admin-num">Max</th>
                      <th className="admin-num">Mean</th>
                      <th className="admin-num">Std dev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) =>
                      group.collections.map((collection) => [
                        <StatRow
                          key={`${group.key}-${collection.id}-q`}
                          label={`${group.label} · ${collection.label} · Favorite`}
                          stats={collection.favorite}
                        />,
                        <StatRow
                          key={`${group.key}-${collection.id}-r`}
                          label={`${group.label} · ${collection.label} · Most realistic`}
                          stats={collection.realism}
                        />,
                      ]),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Histograms by selection, by {dimensionLabel.toLowerCase()}</h2>
            <p className="home-lead analytics-hint">Favorite image level.</p>
            <div className="analytics-histogram-grid">
              {collectionHistCharts.map((chart) => (
                <div key={`${chart.id}-favorite`} className="analytics-plot-card">
                  <h3 className="analytics-plot-title">{chart.label}</h3>
                  {chart.favorite.some((trace) => trace.x.length > 0) ? (
                    <PlotlyChart data={chart.favorite} layout={histLayout} style={{ height: 300 }} />
                  ) : (
                    <Alert severity="info">No ranking data for this filter.</Alert>
                  )}
                </div>
              ))}
            </div>
            <p className="home-lead analytics-hint">Most realistic level.</p>
            <div className="analytics-histogram-grid">
              {collectionHistCharts.map((chart) => (
                <div key={`${chart.id}-realism`} className="analytics-plot-card">
                  <h3 className="analytics-plot-title">{chart.label}</h3>
                  {chart.realism.some((trace) => trace.x.length > 0) ? (
                    <PlotlyChart data={chart.realism} layout={histLayout} style={{ height: 300 }} />
                  ) : (
                    <Alert severity="info">No ranking data for this filter.</Alert>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-section">
            <h2 className="admin-detail-subtitle">Every image, by mean selected level, by {dimensionLabel.toLowerCase()}</h2>
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="analytics-plot-title">{group.label}</h3>
                <p className="home-lead analytics-table-lead">
                  {group.images.length} image{group.images.length === 1 ? '' : 's'} with at least one ranking.
                  Click a column heading to sort, or an image name for its full detail page.
                </p>
                <ImageStatsTable images={group.images} />
              </div>
            ))}
          </section>

          <p className="analytics-generated">Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </>
      ) : null}
    </>
  )
}

function AnalyticsBreakdownPage() {
  const { dimension } = useParams()
  const { authed, checking, signIn, signOut } = useAdminAuth()
  const config = DEMOGRAPHIC_DIMENSIONS.find((entry) => entry.slug === dimension)

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

  if (!config) {
    return (
      <main className="page-shell">
        <section className="page-panel">
          <Alert severity="error">Unknown demographic breakdown &quot;{dimension}&quot;.</Alert>
          <Button component={Link} to="/admin/analytics" variant="outlined" size="small" sx={{ mt: 2 }}>
            Back to analytics
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header admin-header">
          <div>
            <p className="eyebrow">Admin · Analytics</p>
            <h1>{config.label}</h1>
          </div>
          <div className="admin-header-actions">
            <Button component={Link} to="/admin/analytics" variant="outlined" size="small">
              Analytics
            </Button>
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

        <BreakdownView dimensionSlug={config.slug} dimensionLabel={config.label} onSignOut={signOut} />
      </section>
    </main>
  )
}

export default AnalyticsBreakdownPage
