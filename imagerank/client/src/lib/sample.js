// Pick `count` items at random from `items` without mutating the input.
// Used for the rotating set of example images on the home page.
export function sampleRandom(items, count) {
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }

  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, Math.min(count, pool.length))
}

// A thumbnail-friendly URL for an image, preferring the dedicated thumbnail and
// falling back to the original (level 0) variant.
export function thumbnailFor(image) {
  return image?.thumbnailUrl ?? image?.variants?.[0]?.url ?? null
}
