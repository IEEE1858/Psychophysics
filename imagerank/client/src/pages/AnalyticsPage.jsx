import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import { authHeader, useAdminAuth } from '../lib/adminAuth'
import { baseLayout, collectionColor, formatStat } from '../lib/analytics'
import AdminLogin from '../components/AdminLogin'
import PlotlyChart from '../components/PlotlyChart'
import './pages.css'

// Expertise groups get their own fixed colors — independent of the
// sharpness/HDR collection colors — since the expert-vs-layperson chart
// overlays both collections in one plot.
const EXPERTISE_COLORS = { expert: '#e76f51', layperson: '#287271' }
const EXPERTISE_LABELS = { expert: 'Expert', layperson: 'Layperson' }

// Debounce a fast-changing value (e.g. an age text field) so it only settles
// `delay` ms after the user stops typing, instead of firing a request per key.
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const EMPTY_FILTERS = {
  ageMin: '',
  ageMax: '',
  genders: [],
  countries: [],
  visionStatuses: [],
  expertise: [],
  displayTypes: [],
  lightingConditions: [],
  colorBlind: [],
}

// Multi-select filter with chip display, backed by a fixed option list from
// the server's filterOptions (only demographic values actually present in the
// data are offered).
function MultiFilter({ label, value, options, onChange }) {
  if (options.length === 0) {
    return null
  }
  return (
    <FormControl size="small" className="analytics-filter-control" sx={{ width: 130, minWidth: 130 }}>
      <InputLabel id={`${label}-filter-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-filter-label`}
        multiple
        value={value}
        onChange={(event) => onChange(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <div className="analytics-filter-chips">
            {selected.map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
          </div>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

// One min/max/mean/std row for a collection's favorite or realism selections.
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
  // The key of the query whose response is currently on screen. Set only when a
  // request settles, so "refreshing" can be derived below rather than assigned from
  // inside the effect (react-hooks/set-state-in-effect).
  const [loadedParamsKey, setLoadedParamsKey] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // Age is a free-typed text field, so debounce it; the multi-selects fire on
  // pick and don't need one.
  const ageMin = useDebounced(filters.ageMin, 400)
  const ageMax = useDebounced(filters.ageMax, 400)

  const queryParams = useMemo(
    () => ({
      ageMin: ageMin || undefined,
      ageMax: ageMax || undefined,
      gender: filters.genders.length ? filters.genders.join(',') : undefined,
      country: filters.countries.length ? filters.countries.join(',') : undefined,
      vision: filters.visionStatuses.length ? filters.visionStatuses.join(',') : undefined,
      expertise: filters.expertise.length ? filters.expertise.join(',') : undefined,
      displayType: filters.displayTypes.length ? filters.displayTypes.join(',') : undefined,
      lighting: filters.lightingConditions.length ? filters.lightingConditions.join(',') : undefined,
      colorBlind: filters.colorBlind.length ? filters.colorBlind.join(',') : undefined,
    }),
    [
      ageMin,
      ageMax,
      filters.genders,
      filters.countries,
      filters.visionStatuses,
      filters.expertise,
      filters.displayTypes,
      filters.lightingConditions,
      filters.colorBlind,
    ],
  )

  // Derived, not stored: a request is outstanding whenever the params on screen are
  // not the params we last loaded. This also makes the spinner appear in the same
  // render as the filter change, rather than one render later.
  const paramsKey = JSON.stringify(queryParams)
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

  // Memoized for the same reason as expertise below: the ?? fallback allocates a new
  // object every render, so anything depending on its identity would recompute each
  // time. Nothing does today, but the next memo that reads it would silently churn.
  const filterOptions = useMemo(
    () =>
      analytics?.filterOptions ?? {
        genders: [],
        countries: [],
        visionStatuses: [],
        displayTypes: [],
        lightingConditions: [],
        colorBlind: [],
      },
    [analytics],
  )
  const hasActiveFilters =
    Boolean(filters.ageMin) ||
    Boolean(filters.ageMax) ||
    filters.genders.length > 0 ||
    filters.countries.length > 0 ||
    filters.visionStatuses.length > 0 ||
    filters.expertise.length > 0 ||
    filters.displayTypes.length > 0 ||
    filters.lightingConditions.length > 0 ||
    filters.colorBlind.length > 0

  const collections = useMemo(() => analytics?.collections ?? [], [analytics])
  const images = useMemo(() => analytics?.images ?? [], [analytics])
  // Memoized like collections/images above: the ?? fallback allocates a new object
  // every render, which would change the identity of every memo that depends on it.
  const expertise = useMemo(
    () => analytics?.expertise ?? { participants: { expert: 0, layperson: 0 }, collections: [] },
    [analytics],
  )

  // Grouped box plot: one x category per collection × selection, split into an
  // "Expert" and "Layperson" trace so the two groups render side by side
  // (layout.boxmode = 'group').
  const expertiseBoxData = useMemo(
    () =>
      ['expert', 'layperson'].map((group) => {
        const x = []
        const y = []
        expertise.collections.forEach((collection) => {
          const entry = collection[group]
          entry.favoriteLevels.forEach((level) => {
            x.push(`${collection.label} · Favorite`)
            y.push(level)
          })
          entry.realismLevels.forEach((level) => {
            x.push(`${collection.label} · Realism`)
            y.push(level)
          })
        })
        return {
          type: 'box',
          name: EXPERTISE_LABELS[group],
          x,
          y,
          marker: { color: EXPERTISE_COLORS[group] },
          boxmean: 'sd',
          boxpoints: 'outliers',
        }
      }),
    [expertise],
  )

  const expertiseBoxLayout = useMemo(
    () =>
      baseLayout({
        boxmode: 'group',
        showlegend: true,
        legend: { orientation: 'h', y: 1.12, x: 0 },
        yaxis: { title: 'Selected processing level', zeroline: false },
        xaxis: { automargin: true },
      }),
    [],
  )

  // Box/whisker plot: one box per collection × selection, over the raw chosen
  // levels. boxmean: 'sd' overlays the mean and standard deviation.
  const boxData = useMemo(
    () =>
      collections.flatMap((collection) => [
        {
          type: 'box',
          name: `${collection.label} · Favorite`,
          y: collection.favoriteLevels,
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

  // Scatter: one point per image, mean realism (x) vs mean favorite (y), as a
  // percentage of each image's max level so the two collections are comparable.
  // customdata carries the route target for the click handler.
  const scatterData = useMemo(
    () =>
      collections.map((collection) => {
        const points = images.filter(
          (image) =>
            image.collectionId === collection.id &&
            image.meanRealismFrac != null &&
            image.meanFavoriteFrac != null,
        )
        return {
          type: 'scatter',
          mode: 'markers',
          name: collection.label,
          x: points.map((image) => image.meanRealismFrac * 100),
          y: points.map((image) => image.meanFavoriteFrac * 100),
          customdata: points.map((image) => [image.collectionId, image.imageId, image.n]),
          text: points.map((image) => image.imageId),
          hovertemplate:
            '<b>%{text}</b><br>Realism %{x:.0f}%<br>Favorite %{y:.0f}%<br>n = %{customdata[2]}<extra></extra>',
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
        yaxis: { title: 'Mean favorite level (% of max)', range: [-5, 105], zeroline: false },
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
          <section className="analytics-section">
            <div className="analytics-filter-head">
              <h2 className="admin-detail-subtitle">Filters</h2>
              {refreshing ? <CircularProgress size={16} /> : null}
              {hasActiveFilters ? (
                <Button size="small" variant="text" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : null}
            </div>
            <div className="analytics-filter-row">
              <TextField
                size="small"
                type="number"
                label="Age min"
                value={filters.ageMin}
                onChange={(event) => setFilters((prev) => ({ ...prev, ageMin: event.target.value }))}
                className="analytics-filter-control analytics-filter-age"
                sx={{ width: 130, minWidth: 130 }}
                slotProps={{ htmlInput: { min: 0, max: 120 } }}
              />
              <TextField
                size="small"
                type="number"
                label="Age max"
                value={filters.ageMax}
                onChange={(event) => setFilters((prev) => ({ ...prev, ageMax: event.target.value }))}
                className="analytics-filter-control analytics-filter-age"
                sx={{ width: 130, minWidth: 130 }}
                slotProps={{ htmlInput: { min: 0, max: 120 } }}
              />
              <MultiFilter
                label="Gender"
                value={filters.genders}
                options={filterOptions.genders}
                onChange={(next) => setFilters((prev) => ({ ...prev, genders: next }))}
              />
              <MultiFilter
                label="Country"
                value={filters.countries}
                options={filterOptions.countries}
                onChange={(next) => setFilters((prev) => ({ ...prev, countries: next }))}
              />
              <MultiFilter
                label="Vision"
                value={filters.visionStatuses}
                options={filterOptions.visionStatuses}
                onChange={(next) => setFilters((prev) => ({ ...prev, visionStatuses: next }))}
              />
              <MultiFilter
                label="Expertise"
                value={filters.expertise}
                options={['expert', 'layperson']}
                onChange={(next) => setFilters((prev) => ({ ...prev, expertise: next }))}
              />
              <MultiFilter
                label="Display"
                value={filters.displayTypes}
                options={filterOptions.displayTypes}
                onChange={(next) => setFilters((prev) => ({ ...prev, displayTypes: next }))}
              />
              <MultiFilter
                label="Lighting"
                value={filters.lightingConditions}
                options={filterOptions.lightingConditions}
                onChange={(next) => setFilters((prev) => ({ ...prev, lightingConditions: next }))}
              />
              <MultiFilter
                label="Color blind"
                value={filters.colorBlind}
                options={filterOptions.colorBlind}
                onChange={(next) => setFilters((prev) => ({ ...prev, colorBlind: next }))}
              />
            </div>
          </section>

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
            <h2 className="admin-detail-subtitle">Expert vs. layperson</h2>
            <p className="home-lead analytics-hint">
              &quot;Photographer / Imaging Expert&quot; participants compared against everyone else, for
              the demographic slice selected above.
            </p>
            <div className="analytics-cards">
              <StatCard label="Experts" value={expertise.participants.expert} sub="participants" />
              <StatCard label="Laypersons" value={expertise.participants.layperson} sub="participants" />
            </div>
            <div className="analytics-plot-card">
              {expertiseBoxData.some((trace) => trace.y.length > 0) ? (
                <PlotlyChart data={expertiseBoxData} layout={expertiseBoxLayout} style={{ height: 420 }} />
              ) : (
                <Alert severity="info">No ranking data for this filter.</Alert>
              )}
            </div>
          </section>

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
                      label={`${collection.label} · Favorite image`}
                      stats={collection.favorite}
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
            <h2 className="admin-detail-subtitle">Realism vs. favorite by image</h2>
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
                    name: 'Favorite image',
                    x: collection.favoriteLevels,
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
                    {collection.favoriteLevels.length + collection.realismLevels.length > 0 ? (
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
