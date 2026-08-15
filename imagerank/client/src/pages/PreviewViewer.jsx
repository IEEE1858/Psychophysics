import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { findCollection, useLibrary } from '../lib/useLibrary'
import ImageInfoButton from '../components/ImageInfo'
import './pages.css'
import { useT, useTx } from '../lib/i18n'

// A read-only image viewer for the preview flow. It lets a visitor move through
// the processing levels of a single image, but unlike the study it never
// records a "most realistic" / "favorite" selection and has no
// exploration gate.
function PreviewViewer() {
  const { collectionId, imageId } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const tx = useTx()
  const { library, loading, error } = useLibrary()
  const [level, setLevel] = useState(0)
  const [viewedImageId, setViewedImageId] = useState(imageId)

  // Reset to the unprocessed level whenever a different image is opened. This
  // adjust-state-during-render pattern avoids a cascading setState in an effect.
  if (imageId !== viewedImageId) {
    setViewedImageId(imageId)
    setLevel(0)
  }

  const collection = findCollection(library, collectionId)
  const image = collection?.images.find((candidate) => candidate.id === imageId) ?? null
  const maxLevel = image?.maxLevel ?? 0
  const currentVariant =
    image?.variants.find((variant) => variant.level === level) ?? image?.variants[0] ?? null

  useEffect(() => {
    function handleKeyDown(event) {
      if (!image || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      const tagName = event.target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setLevel((current) => Math.max(0, current - 1))
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setLevel((current) => Math.min(maxLevel, current + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [image, maxLevel])

  const backToPreview = collection ? `/preview/${collection.id}` : '/preview/hdr'
  const notFound = !loading && !error && library && !image

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header">
          <Link className="back-link" to={backToPreview}>
            ← Back to image preview
          </Link>
          <p className="eyebrow">{collection ? t('preview.collectionEyebrow', { collection: collection.label }) : t('preview.eyebrow')}</p>
          <h1>{image ? image.label : t('preview.viewerTitle')}</h1>
          <p className="home-lead">
            {t('preview.viewerLead')}
          </p>
        </header>

        {loading ? (
          <div className="home-status">
            <CircularProgress size={28} />
            <span>{t('preview.loadingImage')}</span>
          </div>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {notFound ? (
          <Alert severity="warning">
            {tx('preview.notFound', {
              link: <Link to={backToPreview}>{t('preview.backToGallery')}</Link>,
            })}
          </Alert>
        ) : null}

        {image ? (
          <>
            <div className="viewer-stage">
              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={12}
                centerOnInit
                limitToBounds={false}
                wheel={{ step: 0.12 }}
                doubleClick={{ step: 1.4 }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="viewer-stage-toolbar">
                      <span className="viewer-stage-hint">Scroll to zoom · drag to pan</span>
                      <div className="viewer-stage-actions">
                        <ImageInfoButton image={image} collectionLabel={collection?.label} />
                        <Button size="small" variant="outlined" onClick={() => zoomOut()}>
                          {t('study.topbar.zoomOut')}
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => zoomIn()}>
                          {t('study.topbar.zoomIn')}
                        </Button>
                        <Button size="small" variant="contained" onClick={() => resetTransform(0)}>
                          {t('study.topbar.resetView')}
                        </Button>
                      </div>
                    </div>

                    <TransformComponent wrapperClass="viewer-transform-wrapper" contentClass="viewer-transform-content">
                      <img
                        className="viewer-image"
                        src={currentVariant?.url}
                        alt={`${image.label} at ${currentVariant?.shortLabel ?? 'original'} processing`}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>

            <div className="viewer-slider-block">
              <div className="viewer-slider-labels">
                <span>{t('study.slider.unprocessed')}</span>
                <span>{t('study.slider.heavilyProcessed')}</span>
              </div>

              <Slider
                min={0}
                max={maxLevel}
                step={1}
                value={level}
                onChange={(_, value) => setLevel(Array.isArray(value) ? value[0] : value)}
                aria-label={t('study.slider.aria')}
              />

              <div className="viewer-slider-meta">
                <span>{currentVariant?.description}</span>
                <span>
                  Level {level}/{maxLevel}
                </span>
              </div>
            </div>

            <div className="viewer-actions">
              <Button component={Link} to={backToPreview} variant="outlined">
                {t('preview.backToPreview')}
              </Button>
              <Button variant="contained" className="cta-button" onClick={() => navigate('/demographics')}>
                {t('home.cta.start')}
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default PreviewViewer
