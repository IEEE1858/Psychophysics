import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import { getParticipantId } from '../lib/session'
import './pages.css'

// Render a chosen processing level as "L3 / 8", or an em dash when the
// participant skipped that selection.
function formatLevel(level, maxLevel) {
  if (level == null) {
    return '—'
  }
  return maxLevel != null ? `L${level} / ${maxLevel}` : `L${level}`
}

// "Review and revise your rankings" (issue #23): a two-column grid of every
// image this participant has ranked, with the chosen quality and realism levels
// alongside each. Clicking a card reopens the grading interface for that single
// image (/study?rerank=...) so the participant can re-rank it.
function RankingsPage() {
  const navigate = useNavigate()
  const { library, loading: libraryLoading, error: libraryError } = useLibrary()
  const [rankings, setRankings] = useState(null)
  const [error, setError] = useState('')

  // No session means the participant never started the study — send them home.
  useEffect(() => {
    const participantId = getParticipantId()
    if (!participantId) {
      navigate('/', { replace: true })
      return undefined
    }

    let active = true
    axios
      .get(`/api/participants/${participantId}`)
      .then((response) => {
        if (active) {
          setRankings(response.data?.rankings ?? [])
        }
      })
      .catch(() => {
        if (active) {
          setError('Failed to load your rankings.')
        }
      })
    return () => {
      active = false
    }
  }, [navigate])

  // Resolve "collectionId:imageId" -> image so we can show thumbnails and names.
  const imageLookup = useMemo(() => {
    const lookup = new Map()
    for (const collection of library?.collections ?? []) {
      for (const image of collection.images) {
        lookup.set(`${collection.id}:${image.id}`, image)
      }
    }
    return lookup
  }, [library])

  // Only images that carry an actual decision are revisable; a row with neither
  // selection (e.g. saved by the unload beacon mid-browse) is not shown.
  const rankedItems = useMemo(
    () =>
      (rankings ?? []).filter(
        (ranking) =>
          ranking.most_realistic_level != null || ranking.highest_quality_level != null,
      ),
    [rankings],
  )

  const loading = (rankings === null && !error) || libraryLoading

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header admin-header">
          <div>
            <p className="eyebrow">Your rankings</p>
            <h1>Review and revise</h1>
            <p className="home-lead">
              These are the images you have ranked so far. Select any image to revisit it and
              change your most realistic and highest quality choices.
            </p>
          </div>
          <div className="admin-header-actions">
            <Button onClick={() => navigate('/study')} variant="outlined" size="small">
              Back to study
            </Button>
          </div>
        </header>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {libraryError ? <Alert severity="error">{libraryError}</Alert> : null}

        {loading ? (
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading your rankings…</span>
          </div>
        ) : rankedItems.length === 0 ? (
          <Alert severity="info">
            You haven&apos;t ranked any images yet. Once you rank an image it will appear here.
          </Alert>
        ) : (
          <div className="rankings-grid">
            {rankedItems.map((ranking) => {
              const key = `${ranking.collection_id}:${ranking.image_id}`
              const image = imageLookup.get(key)
              return (
                <button
                  key={key}
                  type="button"
                  className="rankings-card"
                  onClick={() => navigate(`/study?rerank=${encodeURIComponent(key)}`)}
                  title="Revisit and re-rank this image"
                >
                  <div className="admin-ranking-thumb">
                    {image ? (
                      <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
                    ) : (
                      <div className="admin-thumb-missing">no thumbnail</div>
                    )}
                  </div>
                  <div className="rankings-card-body">
                    <div className="admin-ranking-head">
                      <span className="admin-collection-chip">{ranking.collection_id}</span>
                      {ranking.re_ranked ? <span className="rankings-revised-chip">revised</span> : null}
                    </div>
                    <div className="rankings-levels">
                      <span className="rankings-level">
                        <span className="rankings-level-label">Quality</span>
                        <strong>{formatLevel(ranking.highest_quality_level, ranking.max_level)}</strong>
                      </span>
                      <span className="rankings-level">
                        <span className="rankings-level-label">Realism</span>
                        <strong>{formatLevel(ranking.most_realistic_level, ranking.max_level)}</strong>
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default RankingsPage
