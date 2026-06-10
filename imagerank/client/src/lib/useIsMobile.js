import { useEffect, useState } from 'react'

// The study requires a desktop or laptop, so we treat phones/tablets as
// "mobile". We combine a user-agent check (catches mobile devices regardless of
// window size) with a narrow-viewport / coarse-pointer check.
function detectMobile() {
  if (typeof window === 'undefined') {
    return false
  }

  const uaIsMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)
  const coarseAndNarrow =
    window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 820px)').matches

  return uaIsMobile || coarseAndNarrow
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectMobile)

  useEffect(() => {
    function handleResize() {
      setIsMobile(detectMobile())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
