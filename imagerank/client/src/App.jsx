import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Slider from '@mui/material/Slider'
import { useTheme } from '@mui/material/styles'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import {
  getParticipantId,
  getStoredDemographics,
  getStudyPlaylist,
  getStudyPosition,
  getTourSeen,
  setStudyPlaylist,
  setStudyPosition,
  setTourSeen,
} from './lib/session'
import { buildPlaylist, DEFAULT_AVG_GRADING_MS } from './lib/playlist'
import StudyTour from './components/StudyTour'
import { buildTourSteps } from './lib/tourSteps'
import './App.css'

const DEFAULT_TIME_BUDGET_MINUTES = 30

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
    favoriteLevel: imageState.favoriteLevel ?? null,
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
    || imageState.favoriteLevel != null
    || imageState.currentLevel === maxLevel
  )
}

function collectImageUrls(image) {
  return image?.variants?.map((variant) => variant.url).filter(Boolean) ?? []
}

function App() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Re-rank mode (issue #23): /study?rerank=collectionId:imageId reopens the
  // grading interface for one already-ranked image so the participant can
  // revise it. The normal playlist, progress, and completion flow are bypassed.
  const reRankTarget = useMemo(() => {
    const raw = searchParams.get('rerank')
    if (!raw) {
      return null
    }
    const separator = raw.indexOf(':')
    if (separator === -1) {
      return null
    }
    return { collectionId: raw.slice(0, separator), imageId: raw.slice(separator + 1) }
  }, [searchParams])
  const isReRank = Boolean(reRankTarget)
  const transformRef = useRef(null)
  const preloadPromisesRef = useRef(new Map())
  const [library, setLibrary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // The participant's assigned playlist ({ collectionId, imageId }[]) and their
  // current position within it. The playlist is sized to the time budget they
  // reported and excludes images they have already ranked (issue #19).
  const [playlist, setPlaylist] = useState([])
  const [position, setPosition] = useState(0)
  const [imageStates, setImageStates] = useState({})
  const [message, setMessage] = useState(null)
  const [toastClosing, setToastClosing] = useState(false)
  const [viewportTransform, setViewportTransform] = useState(DEFAULT_VIEWPORT)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  // "I have more time" controls on the completion screen.
  const [moreMinutes, setMoreMinutes] = useState(10)
  const [addingMore, setAddingMore] = useState(false)
  const [noMoreImages, setNoMoreImages] = useState(false)
  // "Tour mode" (issue #15): a guided walkthrough of the grading interface. It
  // auto-launches the first time a participant reaches the study (tracked in
  // localStorage); the top-bar [?] button replays it on demand. The tour
  // component only renders once an image is on screen, so run=true here never
  // starts Joyride before its target elements exist.
  const [runTour, setRunTour] = useState(() => !getTourSeen())
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
        const [libraryResponse, participantResponse, statsResponse] = await Promise.all([
          axios.get('/api/library'),
          axios.get(`/api/participants/${participantId}`).catch(() => null),
          axios.get('/api/stats/avg-grading-ms').catch(() => null),
        ])

        const libraryData = libraryResponse.data
        setLibrary(libraryData)
        const collectionsData = libraryData.collections ?? []

        // Restore prior rankings so markers, the exploration gate, and the
        // completion check all reflect what the participant already did. Track
        // which images already carry a decision so we never assign them again.
        const rankings = participantResponse?.data?.rankings ?? []
        const restored = {}
        const rankedKeys = new Set()
        for (const ranking of rankings) {
          const key = getImageKey(ranking.collection_id, ranking.image_id)
          restored[key] = ensureImageState({
            currentLevel: 0,
            furthestVisitedLevel: ranking.furthest_visited_level ?? 0,
            mostRealisticLevel: ranking.most_realistic_level,
            favoriteLevel: ranking.favorite_level,
          })
          if (ranking.most_realistic_level != null || ranking.favorite_level != null) {
            rankedKeys.add(key)
          }
        }
        if (rankings.length > 0) {
          setImageStates(restored)
        }

        // The set of image keys that actually exist in the current library, so a
        // stale stored playlist (an image removed from S3) is silently dropped.
        const validKeys = new Set()
        for (const collection of collectionsData) {
          for (const image of collection.images) {
            validKeys.add(getImageKey(collection.id, image.id))
          }
        }

        // Re-rank mode: show only the requested image. Leave the stored playlist
        // and position untouched so the participant resumes their real study
        // exactly where they left off after they finish revising.
        if (reRankTarget) {
          const targetKey = getImageKey(reRankTarget.collectionId, reRankTarget.imageId)
          if (!validKeys.has(targetKey)) {
            navigate('/rankings', { replace: true })
            return
          }
          setPlaylist([{ collectionId: reRankTarget.collectionId, imageId: reRankTarget.imageId }])
          setPosition(0)
          return
        }

        // Resume an existing playlist, or build one sized to the participant's
        // time budget — interleaving collections and skipping ranked images.
        let playlistData = (getStudyPlaylist() ?? []).filter((item) =>
          validKeys.has(getImageKey(item.collectionId, item.imageId)),
        )
        if (playlistData.length === 0) {
          const avgMs = statsResponse?.data?.avgMs || DEFAULT_AVG_GRADING_MS
          const budgetMinutes = Number(
            getStoredDemographics()?.timeBudgetMinutes
              ?? participantResponse?.data?.participant?.time_budget_minutes,
          ) || DEFAULT_TIME_BUDGET_MINUTES
          playlistData = buildPlaylist({
            collections: collectionsData,
            budgetSeconds: budgetMinutes * 60,
            avgSeconds: avgMs / 1000,
            excludeKeys: rankedKeys,
          })
          setStudyPlaylist(playlistData)
          setStudyPosition(0)
        }
        setPlaylist(playlistData)

        // Resume at the saved position, clamped to the playlist bounds.
        const savedIndex = Math.min(Math.max(getStudyPosition(), 0), Math.max(0, playlistData.length - 1))
        setPosition(savedIndex)

        // Go straight to the thank-you screen when there is nothing left to do:
        // the assigned set is already fully ranked, or a returning participant
        // has ranked every image in the study (so no playlist could be built).
        const allGraded = playlistData.length > 0 && playlistData.every((item) =>
          rankedKeys.has(getImageKey(item.collectionId, item.imageId)),
        )
        if (playlistData.length === 0) {
          setNoMoreImages(true)
          setIsFinished(true)
        } else if (allGraded) {
          setIsFinished(true)
        }
      } catch (error) {
        setLoadError(error.response?.data?.error ?? 'Failed to load images from the server.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate, reRankTarget])

  // Persist the navigation position so a returning participant resumes here.
  // Skipped in re-rank mode, which must not clobber the real study position.
  useEffect(() => {
    if (playlist.length === 0 || isReRank) {
      return
    }
    setStudyPosition(position)
  }, [position, playlist.length, isReRank])

  const collections = useMemo(() => library?.collections ?? [], [library])
  // Resolve the current playlist entry to its collection and image.
  const currentItem = playlist[position] ?? null
  const selectedCollection = currentItem
    ? collections.find((collection) => collection.id === currentItem.collectionId) ?? null
    : null
  const currentImage = selectedCollection?.images.find((image) => image.id === currentItem?.imageId) ?? null
  const imageKey = currentImage && selectedCollection ? getImageKey(selectedCollection.id, currentImage.id) : ''
  const imageState = ensureImageState(imageStates[imageKey])
  const currentVariant = currentImage?.variants.find((variant) => variant.level === imageState.currentLevel) ?? currentImage?.variants[0] ?? null
  const maxLevel = currentImage?.maxLevel ?? 0
  // Navigation flows through the assigned playlist, so the top-bar label reads
  // "<collection> image X of <total>".
  const totalImageCount = playlist.length
  const canGoBack = position > 0
  const isLastImageOverall = position >= totalImageCount - 1

  // Every image this participant has ranked across all sessions — prior
  // rankings restored at load plus anything graded since — not just the current
  // playlist. Shown on the completion screen.
  const totalRankedCount = useMemo(
    () =>
      Object.values(imageStates).reduce((sum, state) => {
        const resolved = ensureImageState(state)
        return sum + (resolved.mostRealisticLevel != null || resolved.favoriteLevel != null ? 1 : 0)
      }, 0),
    [imageStates],
  )

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

  // Build the tour steps for the current image; drop the closing "Next image"
  // step on the last image, where that button is replaced by Finish.
  const tourSteps = useMemo(
    () => buildTourSteps({ isLastImage: isLastImageOverall }),
    [isLastImageOverall],
  )

  function closeTour() {
    setRunTour(false)
    setTourSeen()
  }

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
        favoriteLevel: imageState.favoriteLevel,
        gradingMs: (accumulatedMsRef.current[imageKey] ?? 0) + elapsed,
        // In re-rank mode the server adds this time to the existing total and
        // flags the row; this image was already counted in the study otherwise.
        reRank: isReRank,
      }

      navigator.sendBeacon('/api/rankings', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentImage, selectedCollection, imageKey, maxLevel, imageState, isReRank])

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

    // The next playlist entry may live in a different collection, so resolve it
    // against the whole library rather than the current collection's images.
    const nextItem = playlist[position + 1]
    const nextCollection = nextItem
      ? collections.find((collection) => collection.id === nextItem.collectionId)
      : null
    const nextImage = nextCollection?.images.find((image) => image.id === nextItem?.imageId) ?? null

    // Preload current image variants first, then next image
    collectImageUrls(currentImage).forEach((url) => {
      void preloadUrl(url)
    })

    collectImageUrls(nextImage).forEach((url) => {
      void preloadUrl(url)
    })
  }, [currentImage, selectedCollection, playlist, position, collections])

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
      favoriteLevel: imageState.favoriteLevel,
      gradingMs: flushActiveGradingMs(imageKey),
      // In re-rank mode the server adds this session's time to the prior total
      // and marks the row re_ranked (issue #23).
      reRank: isReRank,
    }

    axios.post('/api/rankings', payload).catch((error) => {
      console.error('Failed to submit ranking', error)
    })
  }

  // Save a revision made in re-rank mode and return to the rankings list. A
  // decision is already present (the image was ranked before), so there is no
  // exploration gate here.
  function saveReRank() {
    submitActiveRanking()
    navigate('/rankings')
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

  // Advance to the next image in the playlist. Gated on enough exploration and
  // a decision being made.
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

    if (position < playlist.length - 1) {
      setPosition(position + 1)
    }
  }

  // Step back to the previous image in the playlist. No exploration gate going
  // back.
  function goPrev() {
    if (!canGoBack) {
      return
    }

    submitActiveRanking()
    setMessage(null)
    setPosition(position - 1)
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

  // "I have more time": build a fresh playlist of images the participant hasn't
  // ranked yet, sized to the extra minutes they asked for, and drop them back
  // into the study. If nothing is left, say so instead.
  async function addMoreTime() {
    setAddingMore(true)
    try {
      const statsResponse = await axios.get('/api/stats/avg-grading-ms').catch(() => null)
      const avgMs = statsResponse?.data?.avgMs || DEFAULT_AVG_GRADING_MS

      const excludeKeys = new Set()
      for (const [key, state] of Object.entries(imageStates)) {
        const resolved = ensureImageState(state)
        if (resolved.mostRealisticLevel != null || resolved.favoriteLevel != null) {
          excludeKeys.add(key)
        }
      }

      const nextPlaylist = buildPlaylist({
        collections,
        budgetSeconds: moreMinutes * 60,
        avgSeconds: avgMs / 1000,
        excludeKeys,
      })

      if (nextPlaylist.length === 0) {
        setNoMoreImages(true)
        return
      }

      setPlaylist(nextPlaylist)
      setStudyPlaylist(nextPlaylist)
      setPosition(0)
      setStudyPosition(0)
      setIsFinished(false)
    } finally {
      setAddingMore(false)
    }
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
        : `Favorite image set to ${currentVariant?.shortLabel ?? 'the current level'}.`,
    )
  }


  if (isFinished) {
    return (
      <main className="app-shell">
        <section className="completion-panel">
          <p className="eyebrow">Study complete</p>
          <h1 className="completion-title">Thank you!</h1>
          <p className="completion-copy">
            {totalRankedCount > 0
              ? `Your responses for all ${totalRankedCount} ${totalRankedCount === 1 ? 'image' : 'images'} you have ranked have been recorded. `
              : 'Your responses have been recorded. '}
            We appreciate the time you took to take part in this study.
          </p>

          {totalRankedCount > 0 ? (
            <div className="completion-review-block">
              <Button variant="outlined" onClick={() => navigate('/rankings')}>
                Review your ranked images
              </Button>
            </div>
          ) : null}

          {noMoreImages ? (
            <p className="completion-copy completion-muted">
              You have now reviewed every image available in the study. Thank you for being so thorough!
            </p>
          ) : (
            <div className="more-time-block">
              <p className="completion-copy">
                Have a little more time? We can show you more images you haven&apos;t seen yet.
              </p>
              <div className="more-time-control">
                <span id="more-time-label" className="more-time-label">
                  {moreMinutes} more {moreMinutes === 1 ? 'minute' : 'minutes'}
                </span>
                <Slider
                  aria-labelledby="more-time-label"
                  value={moreMinutes}
                  onChange={(_, value) => setMoreMinutes(Array.isArray(value) ? value[0] : value)}
                  min={1}
                  max={30}
                  step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value} min`}
                  disabled={addingMore}
                />
              </div>
              <Button variant="contained" onClick={addMoreTime} disabled={addingMore}>
                {addingMore ? 'Loading more images…' : 'Review more images'}
              </Button>
            </div>
          )}

          <p className="completion-copy completion-muted">You can also close this tab.</p>
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
          {loading || loadError || !currentImage
            ? ''
            : isReRank
              ? `Re-ranking: ${selectedCollection.label} — ${currentImage.label}`
              : `${selectedCollection.label} image ${position + 1} of ${totalImageCount}: ${currentImage.label}`}
        </span>

        <div className="study-zoom">
          {isReRank ? (
            <Button size="small" variant="outlined" onClick={() => navigate('/rankings')}>
              Rankings
            </Button>
          ) : (
            <>
              <Button
                size="small"
                variant="outlined"
                className="study-help"
                aria-label="Show the guided tour"
                title="Show the guided tour"
                onClick={() => setRunTour(true)}
              >
                ?
              </Button>
              <Button size="small" variant="outlined" onClick={() => navigate('/rankings')}>
                Rankings
              </Button>
              <Button size="small" variant="outlined" className="study-edit-demographics" onClick={editDemographics}>
                Edit demographics
              </Button>
            </>
          )}
          <Button size="small" variant="outlined" onClick={() => transformRef.current?.zoomOut()}>
            Zoom out
          </Button>
          <Button size="small" variant="outlined" data-tour="zoom" onClick={() => transformRef.current?.zoomIn()}>
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

          <div className="slider-with-markers study-slider" data-tour="slider">
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

            {imageState.favoriteLevel != null ? (
              <span
                className="slider-marker slider-marker-favorite"
                style={{
                  left: `${levelPercent(imageState.favoriteLevel, maxLevel)}%`,
                  borderBottomColor: theme.palette.secondary.main,
                }}
                aria-label={`Favorite image at level ${imageState.favoriteLevel}`}
              />
            ) : null}
          </div>

          <span className="study-slider-label">Heavily processed</span>

          <Button className="study-pick" data-tour="pick-realistic" variant="contained" onClick={() => setSelection('mostRealisticLevel')}>
            Pick Most Realistic
          </Button>

          <Button className="study-pick" data-tour="pick-favorite" variant="contained" color="secondary" onClick={() => setSelection('favoriteLevel')}>
            Pick Favorite Image
          </Button>

          {isReRank ? (
            <Button className="study-nav" variant="contained" color="success" onClick={saveReRank}>
              Save changes
            </Button>
          ) : (
            <>
              {!isLastImageOverall ? (
                <Button className="study-nav" data-tour="next" variant="outlined" onClick={goNext}>
                  Next image
                </Button>
              ) : null}

              {/* Let participants stop whenever they want, not only once every
                  image is graded (issue #39). */}
              <Button className="study-nav" variant="contained" color="success" onClick={finishStudy}>
                Finish
              </Button>
            </>
          )}
        </footer>
      ) : null}

      {message ? (
        <div className={`study-toast${toastClosing ? ' study-toast-closing' : ''}`} role="status">
          <Alert severity={message.severity} variant="filled">{message.text}</Alert>
        </div>
      ) : null}

      {!loading && !loadError && currentImage && !isReRank ? (
        <StudyTour run={runTour} steps={tourSteps} onClose={closeTour} />
      ) : null}
    </main>
  )
}

export default App
