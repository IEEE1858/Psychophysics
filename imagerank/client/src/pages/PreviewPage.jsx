import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { findCollection, useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import './pages.css'

function PreviewPage() {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const { library, loading, error } = useLibrary()

  const collections = library?.collections ?? []
  const collection = findCollection(library, collectionId)
  const notFound = !loading && !error && library && !collection

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header">
          <Link className="back-link" to="/">
            ← Back to home
          </Link>
          <p className="eyebrow">Preview</p>
          <h1>Example images</h1>
          <p className="home-lead">
            Browse every image in each collection. Click any image to open the viewer and move
            through its processing levels. During the study you will rank each one in turn.
          </p>

          {collections.length ? (
            <div className="preview-tabs" role="tablist" aria-label="Image collections">
              {collections.map((item) => (
                <Link
                  key={item.id}
                  to={`/preview/${item.id}`}
                  role="tab"
                  aria-selected={item.id === collection?.id}
                  className={item.id === collection?.id ? 'preview-tab active' : 'preview-tab'}
                >
                  <span>{item.label}</span>
                  <strong>{item.imageCount}</strong>
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading images…</span>
          </div>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {notFound ? (
          <Alert severity="warning">
            No collection named “{collectionId}”. Try{' '}
            <Link to="/preview/hdr">HDR</Link> or <Link to="/preview/sharpness">Sharpness</Link>.
          </Alert>
        ) : null}

        {collection ? (
          <div className="preview-grid">
            {collection.images.map((image) => (
              <Link
                key={image.id}
                to={`/preview/${collection.id}/${image.id}`}
                className="preview-tile"
              >
                <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
                <span className="preview-tile-caption">{image.label}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {collection ? (
          <div className="preview-footer">
            <Button component={Link} to="/" variant="outlined">
              Back to home
            </Button>
            <Button variant="contained" className="cta-button" onClick={() => navigate('/demographics')}>
              Start the Study
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PreviewPage
