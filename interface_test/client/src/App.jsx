import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import './App.css'

const EXPLORATION_RATIO = 0.35
const NEXT_IMAGE_VALIDATION_MESSAGE = 'please move slider to the right to look at other more processed images before deciding.'
const DEFAULT_VIEWPORT = {
  scale: 1,
  positionX: 0,
  positionY: 0,
}

function getImageKey(collectionId, imageId) {
  return `${collectionId}:${imageId}`
}

function ensureImageState(imageState = {}) {
  return {
    currentLevel: imageState.currentLevel ?? 0,
    furthestVisitedLevel: imageState.furthestVisitedLevel ?? 0,
    mostRealisticLevel: imageState.mostRealisticLevel ?? null,
    highestQualityLevel: imageState.highestQualityLevel ?? null,
  }
}

function buildMarks(imageState) {
  const marks = []

  if (imageState.mostRealisticLevel != null) {
    marks.push({ value: imageState.mostRealisticLevel, label: 'R' })
  }

  if (imageState.highestQualityLevel != null) {
    const existingMark = marks.find((mark) => mark.value === imageState.highestQualityLevel)
    if (existingMark) {
      existingMark.label = `${existingMark.label}Q`
    } else {
      marks.push({ value: imageState.highestQualityLevel, label: 'Q' })
    }
  }

  return marks.sort((left, right) => left.value - right.value)
}

function getExplorationThreshold(maxLevel) {
  return Math.max(2, Math.ceil(maxLevel * EXPLORATION_RATIO))
}

function hasAdvanceDecision(imageState, maxLevel) {
  return (
    imageState.mostRealisticLevel != null
    || imageState.highestQualityLevel != null
    || imageState.currentLevel === maxLevel
  )
}

function App() {
  const transformRef = useRef(null)
  const [library, setLibrary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageStates, setImageStates] = useState({})
  const [message, setMessage] = useState(null)
  const [viewportTransform, setViewportTransform] = useState(DEFAULT_VIEWPORT)

  useEffect(() => {
    async function loadLibrary() {
      try {
        const response = await axios.get('/api/library')
        setLibrary(response.data)

        const firstCollection = response.data.collections[0]
        setSelectedCollectionId(firstCollection?.id ?? '')
      } catch (error) {
        setLoadError(error.response?.data?.error ?? 'Failed to load images from the server.')
      } finally {
        setLoading(false)
      }
    }

    loadLibrary()
  }, [])

  const collections = library?.collections ?? []
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0]
  const currentImage = selectedCollection?.images[selectedImageIndex] ?? null
  const imageKey = currentImage ? getImageKey(selectedCollection.id, currentImage.id) : ''
  const imageState = ensureImageState(imageStates[imageKey])
  const currentVariant = currentImage?.variants.find((variant) => variant.level === imageState.currentLevel) ?? currentImage?.variants[0] ?? null
  const maxLevel = currentImage?.maxLevel ?? 0
  const canGoBack = selectedImageIndex > 0
  const canGoForward = Boolean(selectedCollection && selectedImageIndex < selectedCollection.images.length - 1)

  useEffect(() => {
    if (!currentImage || !imageKey) {
      return
    }

    setImageStates((previousStates) => {
      if (previousStates[imageKey]) {
        return previousStates
      }

      return {
        ...previousStates,
        [imageKey]: ensureImageState({}),
      }
    })
  }, [currentImage, imageKey])

  useEffect(() => {
    function handleKeyDown(event) {
      if (!currentImage || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      const tagName = event.target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        updateSliderLevel(Math.max(0, imageState.currentLevel - 1))
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        updateSliderLevel(Math.min(maxLevel, imageState.currentLevel + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentImage, imageState.currentLevel, maxLevel])

  useEffect(() => {
    if (!currentVariant?.url || !transformRef.current) {
      return
    }

    transformRef.current.setTransform(
      viewportTransform.positionX,
      viewportTransform.positionY,
      viewportTransform.scale,
      0,
    )
  }, [currentVariant?.url, viewportTransform.positionX, viewportTransform.positionY, viewportTransform.scale])

  function updateSliderLevel(level) {
    if (!imageKey) {
      return
    }

    setMessage(null)
    setImageStates((previousStates) => {
      const nextState = ensureImageState(previousStates[imageKey])
      return {
        ...previousStates,
        [imageKey]: {
          ...nextState,
          currentLevel: level,
          furthestVisitedLevel: Math.max(nextState.furthestVisitedLevel, level),
        },
      }
    })
  }

  function switchCollection(collectionId) {
    setSelectedCollectionId(collectionId)
    setSelectedImageIndex(0)
    setMessage(null)
  }

  function moveToImage(nextIndex) {
    if (nextIndex > selectedImageIndex && currentImage) {
      const threshold = getExplorationThreshold(maxLevel)
      const exploredEnough = imageState.furthestVisitedLevel >= threshold || imageState.currentLevel === maxLevel
      const madeDecision = hasAdvanceDecision(imageState, maxLevel)

      if (!exploredEnough || !madeDecision) {
        setMessage({
          severity: 'error',
          text: NEXT_IMAGE_VALIDATION_MESSAGE,
        })
        return
      }
    }

    setSelectedImageIndex(nextIndex)
    setMessage(null)
  }

  function setSelection(selectionType) {
    if (!currentImage || !imageKey) {
      return
    }

    const threshold = getExplorationThreshold(maxLevel)
    const exploredEnough = imageState.furthestVisitedLevel >= threshold || imageState.currentLevel === maxLevel

    if (!exploredEnough) {
      setMessage({
        severity: 'error',
        text: NEXT_IMAGE_VALIDATION_MESSAGE,
      })
      return
    }

    setImageStates((previousStates) => {
      const nextState = ensureImageState(previousStates[imageKey])
      return {
        ...previousStates,
        [imageKey]: {
          ...nextState,
          [selectionType]: imageState.currentLevel,
        },
      }
    })

    setMessage({
      severity: 'success',
      text:
        selectionType === 'mostRealisticLevel'
          ? `Most realistic image set to ${currentVariant?.shortLabel ?? 'the current level'}.`
          : `Highest quality image set to ${currentVariant?.shortLabel ?? 'the current level'}.`,
    })
  }

  const sliderMarks = buildMarks(imageState)

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Psychophysics Interface Test</p>
            <h1>Explore processing strength and record the best-looking level.</h1>
            <p className="hero-copy">
              Browse full-resolution Sharpness and HDR image sets, move through processing levels,
              and mark the most realistic and highest quality version for each image.
            </p>
          </div>

          <div className="collection-switcher" role="tablist" aria-label="Image collections">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={collection.id === selectedCollection?.id ? 'collection-tab active' : 'collection-tab'}
                onClick={() => switchCollection(collection.id)}
              >
                <span>{collection.label}</span>
                <strong>{collection.imageCount}</strong>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="status-panel">
            <CircularProgress size={32} />
            <span>Loading image library…</span>
          </div>
        ) : null}

        {loadError ? <Alert severity="error">{loadError}</Alert> : null}

        {!loading && !loadError && currentImage ? (
          <>
            <section className="toolbar">
              <div className="toolbar-header">
                <div>
                  <p className="image-index">
                    {selectedCollection.label} image {selectedImageIndex + 1} of {selectedCollection.images.length}
                  </p>
                  <h2>{currentImage.label}</h2>
                </div>
                <div className="selection-summary">
                  <span>
                    Most realistic:{' '}
                    {imageState.mostRealisticLevel == null
                      ? 'not set'
                      : currentImage.variants.find((variant) => variant.level === imageState.mostRealisticLevel)?.shortLabel}
                  </span>
                  <span>
                    Highest quality:{' '}
                    {imageState.highestQualityLevel == null
                      ? 'not set'
                      : currentImage.variants.find((variant) => variant.level === imageState.highestQualityLevel)?.shortLabel}
                  </span>
                </div>
              </div>

              <div className="toolbar-controls">
                {canGoBack ? (
                  <Button variant="outlined" onClick={() => moveToImage(selectedImageIndex - 1)}>
                    Previous image
                  </Button>
                ) : (
                  <div className="button-placeholder" aria-hidden="true" />
                )}

                <div className="slider-block">
                  <div className="slider-label-row">
                    <span>Unprocessed</span>
                    <span>Heavily processed</span>
                  </div>

                  <Slider
                    min={0}
                    max={maxLevel}
                    marks={sliderMarks}
                    step={1}
                    value={imageState.currentLevel}
                    onChange={(_, value) => updateSliderLevel(Array.isArray(value) ? value[0] : value)}
                    aria-label="Processing level"
                  />

                  <div className="slider-meta-row">
                    <span>{currentVariant?.description}</span>
                    <span>
                      Explored to {imageState.furthestVisitedLevel}/{maxLevel}
                    </span>
                  </div>
                </div>

                <Button variant="contained" onClick={() => setSelection('mostRealisticLevel')}>
                  Set Most Realistic Image
                </Button>

                <Button variant="contained" color="secondary" onClick={() => setSelection('highestQualityLevel')}>
                  Set Highest Quality Image
                </Button>

                {canGoForward ? (
                  <Button variant="outlined" onClick={() => moveToImage(selectedImageIndex + 1)}>
                    Next image
                  </Button>
                ) : (
                  <div className="button-placeholder" aria-hidden="true" />
                )}
              </div>

              {message ? <Alert severity={message.severity}>{message.text}</Alert> : null}
            </section>

            <section className="image-stage">
              <TransformWrapper
                ref={transformRef}
                initialScale={DEFAULT_VIEWPORT.scale}
                minScale={1}
                maxScale={12}
                centerOnInit
                limitToBounds={false}
                wheel={{ step: 0.12 }}
                doubleClick={{ step: 1.4 }}
                onTransformed={(_, state) => {
                  setViewportTransform((previousTransform) => {
                    if (
                      previousTransform.scale === state.scale
                      && previousTransform.positionX === state.positionX
                      && previousTransform.positionY === state.positionY
                    ) {
                      return previousTransform
                    }

                    return {
                      scale: state.scale,
                      positionX: state.positionX,
                      positionY: state.positionY,
                    }
                  })
                }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="image-stage-toolbar">
                      <div className="image-stage-hint">
                        Scroll to zoom. Drag to pan. View stays locked while you switch images.
                      </div>
                      <div className="image-stage-actions">
                        <Button size="small" variant="outlined" onClick={() => zoomOut()}>
                          Zoom out
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => zoomIn()}>
                          Zoom in
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            resetTransform(0)
                            setViewportTransform(DEFAULT_VIEWPORT)
                          }}
                        >
                          Reset view
                        </Button>
                      </div>
                    </div>

                    <TransformComponent wrapperClass="transform-wrapper" contentClass="transform-content">
                      <img
                        className="stage-image"
                        src={currentVariant?.url}
                        alt={`${currentImage.label} at ${currentVariant?.shortLabel ?? 'original'} processing`}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default App
