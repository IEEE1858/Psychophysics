import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { useTheme } from '@mui/material/styles'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { getParticipantId, getStudyPosition, setStudyPosition } from './lib/session'
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

// Position of a level along the slider track, as a percentage (0-100).
function levelPercent(level, maxLevel) {
  if (maxLevel <= 0 || level == null) {
    return 0
  }
  return (level / maxLevel) * 100
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

function collectImageUrls(image) {
  return image?.variants?.map((variant) => variant.url).filter(Boolean) ?? []
}

function App() {
  const theme = useTheme()
  const navigate = useNavigate()
  const transformRef = useRef(null)
  const preloadPromisesRef = useRef(new Map())
  const [library, setLibrary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageStates, setImageStates] = useState({})
  const [message, setMessage] = useState(null)
  const [toastClosing, setToastClosing] = useState(false)
  const [viewportTransform, setViewportTransform] = useState(DEFAULT_VIEWPORT)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const loadedImageUrlsRef = useRef(new Set())
  const participantIdRef = useRef(null)
  const gradingStartRef = useRef(0)
  const accumulatedMsRef = useRef({})
  // True for the brief window around a click that itself raised a new toast, so
  // the dismiss-on-click listener doesn't immediately close that fresh toast.
  const justNotifiedRef = useRef(false)

  // Load the library and (for a returning participant) their saved progress,
  // then resume at the position they left off. A missing session means the
  // participant skipped demographics, so send them there first.
  useEffect(() => {
    const participantId = getParticipantId()
    if (!participantId) {
      navigate('/demographics', { replace: true })
      return
    }
    participantIdRef.current = participantId

    async function load() {
      try {
        const [libraryResponse, participantResponse] = await Promise.all([
          axios.get('/api/library'),
          axios.get(`/api/participants/${participantId}`).catch(() => null),
        ])

        const libraryData = libraryResponse.data
        setLibrary(libraryData)

        // Restore prior rankings so markers, the exploration gate, and the
        // completion check all reflect what the participant already did.
        const rankings = participantResponse?.data?.rankings ?? []
        if (rankings.length > 0) {
          const restored = {}
          for (const ranking of rankings) {
            restored[getImageKey(ranking.collection_id, ranking.image_id)] = ensureImageState({
              currentLevel: 0,
              furthestVisitedLevel: ranking.furthest_visited_level ?? 0,
              mostRealisticLevel: ranking.most_realistic_level,
              highestQualityLevel: ranking.highest_quality_level,
            })
          }
          setImageStates(restored)
        }

        // Restore the saved navigation position, falling back to the start.
        const collectionsData = libraryData.collections ?? []
        const savedPosition = getStudyPosition()
        const savedCollection = collectionsData.find((collection) => collection.id === savedPosition?.collectionId)
        if (savedCollection) {
          const maxIndex = savedCollection.images.length - 1
          setSelectedCollectionId(savedCollection.id)
          setSelectedImageIndex(Math.min(Math.max(savedPosition.imageIndex ?? 0, 0), maxIndex))
        } else {
          setSelectedCollectionId(collectionsData[0]?.id ?? '')
        }
      } catch (error) {
        setLoadError(error.response?.data?.error ?? 'Failed to load images from the server.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate])

  // Persist the navigation position so a returning participant resumes here.
  useEffect(() => {
    if (!selectedCollectionId) {
      return
    }
    setStudyPosition({ collectionId: selectedCollectionId, imageIndex: selectedImageIndex })
  }, [selectedCollectionId, selectedImageIndex])

  const collections = library?.collections ?? []
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0]
  const currentImage = selectedCollection?.images[selectedImageIndex] ?? null
  const imageKey = currentImage ? getImageKey(selectedCollection.id, currentImage.id) : ''
  const imageState = ensureImageState(imageStates[imageKey])
  const currentVariant = currentImage?.variants.find((variant) => variant.level === imageState.currentLevel) ?? currentImage?.variants[0] ?? null
  const maxLevel = currentImage?.maxLevel ?? 0
  // Navigation flows linearly across collections (Sharpness then HDR), so the
  // top-bar label can read "<collection> image X of <total>".
  const collectionIndex = collections.findIndex((collection) => collection.id === selectedCollection?.id)
  const isLastInCollection = Boolean(selectedCollection) && selectedImageIndex >= selectedCollection.images.length - 1
  const canGoBack = selectedImageIndex > 0 || collectionIndex > 0
  const isLastImageOverall = isLastInCollection && collectionIndex === collections.length - 1

  // The study is complete once every image in every collection has at least one
  // selection (most realistic or highest quality).
  const totalImageCount = collections.reduce((sum, collection) => sum + collection.images.length, 0)
  const gradedImageCount = collections.reduce((sum, collection) => {
    return sum + collection.images.filter((image) => {
      const state = ensureImageState(imageStates[getImageKey(collection.id, image.id)])
      return state.mostRealisticLevel != null || state.highestQualityLevel != null
    }).length
  }, 0)
  const allImagesGraded = totalImageCount > 0 && gradedImageCount === totalImageCount

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

  // Start the grading clock fresh whenever a different image becomes active.
  useEffect(() => {
    if (!imageKey) {
      return
    }
    gradingStartRef.current = Date.now()
  }, [imageKey])

  // The per-navigation submit covers in-app moves; this beacon captures the
  // image still on screen if the participant closes or refreshes the tab.
  useEffect(() => {
    function handleBeforeUnload() {
      const participantId = participantIdRef.current
      if (!participantId || !currentImage || !selectedCollection || !imageKey) {
        return
      }

      const elapsed = Math.max(0, Date.now() - gradingStartRef.current)
      const payload = {
        participantId: Number(participantId),
        collectionId: selectedCollection.id,
        imageId: currentImage.id,
        maxLevel,
        furthestVisitedLevel: imageState.furthestVisitedLevel,
        mostRealisticLevel: imageState.mostRealisticLevel,
        highestQualityLevel: imageState.highestQualityLevel,
        gradingMs: (accumulatedMsRef.current[imageKey] ?? 0) + elapsed,
      }

      navigator.sendBeacon('/api/rankings', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentImage, selectedCollection, imageKey, maxLevel, imageState])

  // Begin fading the toast on a click anywhere — unless that click just raised
  // a new toast (justNotifiedRef), in which case keep the new one.
  useEffect(() => {
    if (!message || toastClosing) {
      return undefined
    }

    function dismiss() {
      if (justNotifiedRef.current) {
        justNotifiedRef.current = false
        return
      }
      setToastClosing(true)
    }

    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [message, toastClosing])

  // After the fade-out transition, remove the toast from the DOM.
  useEffect(() => {
    if (!toastClosing) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setMessage(null)
      setToastClosing(false)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [toastClosing])

  const handleArrowSliderStep = useEffectEvent((direction) => {
    if (direction < 0) {
      updateSliderLevel(Math.max(0, imageState.currentLevel - 1))
      return
    }

    updateSliderLevel(Math.min(maxLevel, imageState.currentLevel + 1))
  })

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
        handleArrowSliderStep(-1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleArrowSliderStep(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentImage])

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

  useEffect(() => {
    function preloadUrl(url) {
      if (!url) {
        return Promise.resolve()
      }

      const existingPromise = preloadPromisesRef.current.get(url)
      if (existingPromise) {
        return existingPromise
      }

      const preloadPromise = new Promise((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.loading = 'eager'
        img.onload = () => {
          loadedImageUrlsRef.current.add(url)
          resolve()
        }
        img.onerror = () => {
          loadedImageUrlsRef.current.add(url)
          resolve()
        }
        img.src = url
      })

      preloadPromisesRef.current.set(url, preloadPromise)
      return preloadPromise
    }

    if (!currentImage || !selectedCollection) {
      return undefined
    }

    const nextImage = selectedCollection.images[selectedImageIndex + 1]

    // Preload current image variants first, then next image
    collectImageUrls(currentImage).forEach((url) => {
      void preloadUrl(url)
    })

    collectImageUrls(nextImage).forEach((url) => {
      void preloadUrl(url)
    })
  }, [currentImage, selectedCollection, selectedImageIndex])

  useEffect(() => {
    const url = currentVariant?.url

    if (!url) {
      setShowLoadingModal(false)
      return undefined
    }

    if (loadedImageUrlsRef.current.has(url)) {
      setShowLoadingModal(false)
      return undefined
    }

    setShowLoadingModal(true)

    let dismissed = false
    let rafId

    function tick() {
      if (dismissed) {
        return
      }

      if (loadedImageUrlsRef.current.has(url)) {
        setTimeout(() => {
          if (!dismissed) {
            setShowLoadingModal(false)
          }
        }, 200)
        return
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      dismissed = true
      if (rafId != null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [currentVariant?.url, imageKey])

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

  // Roll the time spent on `key` since the clock last started into its running
  // total, restart the clock, and return the new total in milliseconds.
  function flushActiveGradingMs(key) {
    if (!key) {
      return 0
    }
    const elapsed = Math.max(0, Date.now() - gradingStartRef.current)
    const total = (accumulatedMsRef.current[key] ?? 0) + elapsed
    accumulatedMsRef.current[key] = total
    gradingStartRef.current = Date.now()
    return total
  }

  // Persist the ranking for the image the participant is leaving. Best-effort:
  // failures are logged but never block navigation, and the upsert on the
  // server means re-submitting the same image just overwrites the prior row.
  function submitActiveRanking() {
    const participantId = participantIdRef.current
    if (!participantId || !currentImage || !selectedCollection || !imageKey) {
      return
    }

    const payload = {
      participantId: Number(participantId),
      collectionId: selectedCollection.id,
      imageId: currentImage.id,
      maxLevel,
      furthestVisitedLevel: imageState.furthestVisitedLevel,
      mostRealisticLevel: imageState.mostRealisticLevel,
      highestQualityLevel: imageState.highestQualityLevel,
      gradingMs: flushActiveGradingMs(imageKey),
    }

    axios.post('/api/rankings', payload).catch((error) => {
      console.error('Failed to submit ranking', error)
    })
  }

  // Show a toast message. Mark the raising click so the dismiss listener won't
  // close this fresh toast; the flag is cleared on the next tick.
  function notify(severity, text) {
    justNotifiedRef.current = true
    window.setTimeout(() => {
      justNotifiedRef.current = false
    }, 0)
    setToastClosing(false)
    setMessage({ severity, text })
  }

  // Advance to the next image, crossing into the next collection at the end of
  // the current one. Gated on enough exploration and a decision being made.
  function goNext() {
    if (!currentImage || !selectedCollection) {
      return
    }

    const threshold = getExplorationThreshold(maxLevel)
    const exploredEnough = imageState.furthestVisitedLevel >= threshold || imageState.currentLevel === maxLevel
    const madeDecision = hasAdvanceDecision(imageState, maxLevel)

    if (!exploredEnough || !madeDecision) {
      notify('error', NEXT_IMAGE_VALIDATION_MESSAGE)
      return
    }

    submitActiveRanking()
    setMessage(null)

    if (selectedImageIndex < selectedCollection.images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
    } else if (collectionIndex < collections.length - 1) {
      setSelectedCollectionId(collections[collectionIndex + 1].id)
      setSelectedImageIndex(0)
    }
  }

  // Step back to the previous image, crossing into the previous collection's
  // last image at the start of the current one. No exploration gate going back.
  function goPrev() {
    if (!canGoBack) {
      return
    }

    submitActiveRanking()
    setMessage(null)

    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    } else if (collectionIndex > 0) {
      const previousCollection = collections[collectionIndex - 1]
      setSelectedCollectionId(previousCollection.id)
      setSelectedImageIndex(previousCollection.images.length - 1)
    }
  }

  function finishStudy() {
    // Persist the image currently on screen, mark the session complete (so it's
    // no longer a partial submission), then show the completion screen.
    submitActiveRanking()
    const participantId = participantIdRef.current
    if (participantId) {
      axios.post(`/api/participants/${participantId}/complete`).catch((error) => {
        console.error('Failed to mark study complete', error)
      })
    }
    setIsFinished(true)
  }

  // Save progress for the current image, then go edit demographics. On save the
  // demographics page returns the participant to the study at this position.
  function editDemographics() {
    submitActiveRanking()
    navigate('/demographics?edit=1')
  }

  function setSelection(selectionType) {
    if (!currentImage || !imageKey) {
      return
    }

    const threshold = getExplorationThreshold(maxLevel)
    const exploredEnough = imageState.furthestVisitedLevel >= threshold || imageState.currentLevel === maxLevel

    if (!exploredEnough) {
      notify('error', NEXT_IMAGE_VALIDATION_MESSAGE)
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

    notify(
      'success',
      selectionType === 'mostRealisticLevel'
        ? `Most realistic image set to ${currentVariant?.shortLabel ?? 'the current level'}.`
        : `Highest quality image set to ${currentVariant?.shortLabel ?? 'the current level'}.`,
    )
  }


  if (isFinished) {
    return (
      <main className="app-shell">
        <section className="completion-panel">
          <p className="eyebrow">Study complete</p>
          <h1 className="completion-title">Thank you!</h1>
          <p className="completion-copy">
            Your responses for all {totalImageCount} images have been recorded. We appreciate the
            time you took to take part in this study.
          </p>
          <p className="completion-copy completion-muted">You can now close this tab.</p>
          <a className="completion-home-link" href="/">
            Return to the home page
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="study-shell">
      <header className="study-topbar">
        <span className="study-brand">IEEE 1858 CPIQ Image Rank</span>

        <span className="study-center">
          {!loading && !loadError && currentImage
            ? `${selectedCollection.label} image ${selectedImageIndex + 1} of ${selectedCollection.images.length}: ${currentImage.label}`
            : ''}
        </span>

        <div className="study-zoom">
          <Button size="small" variant="outlined" className="study-edit-demographics" onClick={editDemographics}>
            Edit demographics
          </Button>
          <Button size="small" variant="outlined" onClick={() => transformRef.current?.zoomOut()}>
            Zoom out
          </Button>
          <Button size="small" variant="outlined" onClick={() => transformRef.current?.zoomIn()}>
            Zoom in
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              transformRef.current?.resetTransform(0)
              setViewportTransform(DEFAULT_VIEWPORT)
            }}
          >
            Reset view
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="study-status">
          <CircularProgress size={32} />
          <span>Loading image library…</span>
        </div>
      ) : null}

      {loadError ? (
        <div className="study-status">
          <Alert severity="error">{loadError}</Alert>
        </div>
      ) : null}

      {!loading && !loadError && currentImage ? (
        <section className="study-stage">
          {showLoadingModal ? (
            <div className="image-loading-overlay" role="dialog" aria-modal="true" aria-label="Loading image">
              <div className="loading-modal">
                <h2 className="loading-modal-title">Loading image</h2>
                <p className="loading-modal-image">{currentImage?.label} — {currentVariant?.shortLabel}</p>
                <CircularProgress size={36} />
              </div>
            </div>
          ) : null}

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
            <TransformComponent wrapperClass="transform-wrapper" contentClass="transform-content">
              <img
                className="stage-image"
                src={currentVariant?.url}
                alt={`${currentImage.label} at ${currentVariant?.shortLabel ?? 'original'} processing`}
              />
            </TransformComponent>
          </TransformWrapper>
        </section>
      ) : null}

      {!loading && !loadError && currentImage ? (
        <footer className="study-bottombar">
          {canGoBack ? (
            <Button className="study-nav" size="small" variant="outlined" onClick={goPrev}>
              Previous
            </Button>
          ) : null}

          <span className="study-slider-label">Unprocessed</span>

          <div className="slider-with-markers study-slider">
            {imageState.mostRealisticLevel != null ? (
              <span
                className="slider-marker slider-marker-realism"
                style={{
                  left: `${levelPercent(imageState.mostRealisticLevel, maxLevel)}%`,
                  borderTopColor: theme.palette.primary.main,
                }}
                aria-label={`Most realistic at level ${imageState.mostRealisticLevel}`}
              />
            ) : null}

            <Slider
              min={0}
              max={maxLevel}
              step={1}
              value={imageState.currentLevel}
              onChange={(_, value) => updateSliderLevel(Array.isArray(value) ? value[0] : value)}
              aria-label="Processing level"
            />

            {imageState.highestQualityLevel != null ? (
              <span
                className="slider-marker slider-marker-quality"
                style={{
                  left: `${levelPercent(imageState.highestQualityLevel, maxLevel)}%`,
                  borderBottomColor: theme.palette.secondary.main,
                }}
                aria-label={`Highest quality at level ${imageState.highestQualityLevel}`}
              />
            ) : null}
          </div>

          <span className="study-slider-label">Heavily processed</span>

          <Button className="study-pick" variant="contained" onClick={() => setSelection('mostRealisticLevel')}>
            Pick Most Realistic
          </Button>

          <Button className="study-pick" variant="contained" color="secondary" onClick={() => setSelection('highestQualityLevel')}>
            Pick Highest Quality
          </Button>

          {!isLastImageOverall ? (
            <Button className="study-nav" variant="outlined" onClick={goNext}>
              Next image
            </Button>
          ) : null}

          {allImagesGraded ? (
            <Button className="study-nav" variant="contained" color="success" onClick={finishStudy}>
              Finish
            </Button>
          ) : null}
        </footer>
      ) : null}

      {message ? (
        <div className={`study-toast${toastClosing ? ' study-toast-closing' : ''}`} role="status">
          <Alert severity={message.severity} variant="filled">{message.text}</Alert>
        </div>
      ) : null}
    </main>
  )
}

export default App
