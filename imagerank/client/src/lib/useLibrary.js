import { useEffect, useState } from 'react'
import axios from 'axios'

// The image library is identical for every page (home, preview, study), so we
// fetch it once and share the in-flight promise across all consumers.
let libraryPromise = null

export function fetchLibrary() {
  if (!libraryPromise) {
    libraryPromise = axios.get('/api/library').then((response) => response.data)
  }
  return libraryPromise
}

export function useLibrary() {
  const [library, setLibrary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetchLibrary()
      .then((data) => {
        if (active) {
          setLibrary(data)
          setLoading(false)
        }
      })
      .catch((requestError) => {
        if (active) {
          // A failed fetch should be retryable on the next mount.
          libraryPromise = null
          setError(requestError.response?.data?.error ?? 'Failed to load images from the server.')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return { library, loading, error }
}

export function findCollection(library, collectionId) {
  return library?.collections?.find((collection) => collection.id === collectionId) ?? null
}
