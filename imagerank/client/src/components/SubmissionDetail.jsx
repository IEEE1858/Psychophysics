// One subject's demographics and every image they ranked. Rendered both inside
// the admin submissions list and as its own page at /admin/subjects/:id, which
// the image detail page links to (issue #59).
import { useEffect, useState } from 'react'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { thumbnailFor } from '../lib/sample'
import { authHeader } from '../lib/adminAuth'
import { formatDateTime, formatDuration, formatLevel, subjectEmail, subjectLabel } from '../lib/analytics'
import '../pages/pages.css'

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
      {onBack ? (
        <Button variant="text" onClick={onBack} className="admin-back">
          ← Back to submissions
        </Button>
      ) : null}

      {loading ? (
        <div className="home-status">
          <CircularProgress size={28} />
          <span>Loading submission…</span>
        </div>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {participant ? (
        <>
          <h2 className="admin-detail-title">{subjectLabel(participant)}</h2>
          <div className="admin-meta-grid">
            <span><strong>Started:</strong> {formatDateTime(participant.created_at)}</span>
            {subjectEmail(participant) ? null : (
              <span><strong>IP address:</strong> {participant.ip_address ?? '—'}</span>
            )}
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
              const image = imageLookup?.get(`${ranking.collection_id}:${ranking.image_id}`) ?? null
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
                      <span>Active: <strong>{formatDuration(Math.max(0, (ranking.grading_ms ?? 0) - (ranking.idle_ms ?? 0)))}</strong></span>
                      <span>Idle: <strong>{formatDuration(ranking.idle_ms)}</strong></span>
                      <span>Max zoom: <strong>{ranking.max_zoom_scale != null ? `${Number(ranking.max_zoom_scale).toFixed(1)}× (${Math.round(ranking.max_zoom_pct ?? 0)}% width)` : '—'}</strong></span>
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

export default SubmissionDetail
