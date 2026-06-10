// Builds a participant's image playlist: the ordered set of images they will
// rank, sized to the time they said they have and interleaved across the
// available collections (Sharpness / HDR). Previously-ranked images are
// excluded so a returning participant is never shown the same image twice.

// Fallback per-image grading time used until enough real timings exist to
// compute an average from accumulated responses (issue #19).
export const DEFAULT_AVG_GRADING_MS = 30 * 1000

// A study key uniquely identifies an image within a collection.
export function studyKey(collectionId, imageId) {
  return `${collectionId}:${imageId}`
}

function shuffle(items) {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

// Number of images that fit in `budgetSeconds` at `avgSeconds` per image,
// always at least 1 so a participant is never handed an empty study.
export function imagesForBudget(budgetSeconds, avgSeconds) {
  const perImage = Math.max(1, avgSeconds)
  return Math.max(1, Math.floor(budgetSeconds / perImage))
}

// Build the playlist. Draws round-robin across collections so the result
// alternates categories (≈50/50), falling back to whichever collection still
// has unranked images once the other is exhausted. Caps at the time budget.
//
//   collections   – library collections, each { id, images: [{ id }] }
//   budgetSeconds  – total time the participant reported, in seconds
//   avgSeconds     – average time spent grading one image, in seconds
//   excludeKeys    – Set of studyKey()s the participant has already ranked
export function buildPlaylist({ collections = [], budgetSeconds, avgSeconds, excludeKeys = new Set() }) {
  const targetCount = imagesForBudget(budgetSeconds, avgSeconds)

  const pools = collections.map((collection) => shuffle(
    (collection.images ?? [])
      .filter((image) => !excludeKeys.has(studyKey(collection.id, image.id)))
      .map((image) => ({ collectionId: collection.id, imageId: image.id })),
  ))

  const playlist = []
  let drewThisRound = true
  while (playlist.length < targetCount && drewThisRound) {
    drewThisRound = false
    for (const pool of pools) {
      if (playlist.length >= targetCount) {
        break
      }
      const next = pool.shift()
      if (next) {
        playlist.push(next)
        drewThisRound = true
      }
    }
  }

  return playlist
}
