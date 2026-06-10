import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { findCollection, useLibrary } from '../lib/useLibrary'
import './pages.css'

// A read-only image viewer for the preview flow. It lets a visitor move through
// the processing levels of a single image, but unlike the study it never
// records a "most realistic" / "highest quality" selection and has no
// exploration gate.
function PreviewViewer() {
  const { collectionId, imageId } = useParams()
  const navigate = useNavigate()
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
          <p className="eyebrow">{collection ? `${collection.label} preview` : 'Preview'}</p>
          <h1>{image ? image.label : 'Image viewer'}</h1>
          <p className="home-lead">
            Move the slider to compare processing levels. This is a preview only — your selections
            here are not recorded.
          </p>
        </header>

        {loading ? (
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading image…</span>
          </div>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {notFound ? (
          <Alert severity="warning">
            That image was not found. <Link to={backToPreview}>Back to the gallery</Link>.
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
                        <Button size="small" variant="outlined" onClick={() => zoomOut()}>
                          Zoom out
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => zoomIn()}>
                          Zoom in
                        </Button>
                        <Button size="small" variant="contained" onClick={() => resetTransform(0)}>
                          Reset view
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
                <span>Unprocessed</span>
                <span>Heavily processed</span>
              </div>

              <Slider
                min={0}
                max={maxLevel}
                step={1}
                value={level}
                onChange={(_, value) => setLevel(Array.isArray(value) ? value[0] : value)}
                aria-label="Processing level"
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
                Back to image preview
              </Button>
              <Button variant="contained" className="cta-button" onClick={() => navigate('/demographics')}>
                Start the Study
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default PreviewViewer
