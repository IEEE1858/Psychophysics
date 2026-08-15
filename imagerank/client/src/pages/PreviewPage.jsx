import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { findCollection, useLibrary } from '../lib/useLibrary'
import { thumbnailFor } from '../lib/sample'
import './pages.css'
import { useT, useTx } from '../lib/i18n'

function PreviewPage() {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const tx = useTx()
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
          <p className="eyebrow">{t('preview.eyebrow')}</p>
          <h1>{t('preview.title')}</h1>
          <p className="home-lead">
            {t('preview.lead')}
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
            <span>{t('preview.loading')}</span>
          </div>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {notFound ? (
          <Alert severity="warning">
            {tx('preview.noCollection', {
              name: collectionId,
              hdr: <Link to="/preview/hdr">{t('home.examples.hdr.title')}</Link>,
              sharpness: <Link to="/preview/sharpness">{t('home.examples.sharpness.title')}</Link>,
            })}
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
              {t('preview.backHome')}
            </Button>
            <Button variant="contained" className="cta-button" onClick={() => navigate('/demographics')}>
              {t('home.cta.start')}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PreviewPage
