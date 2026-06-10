import { useEffect, useRef } from 'react'

// Plotly ships ~3 MB, so it is imported dynamically and cached: the bundle is
// only fetched on the admin analytics pages, never on the participant-facing
// study. Plotly natively supports the three chart types issue #24 calls for —
// box/whisker plots, histograms, and a clickable scatter.
let plotlyPromise = null
function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist-min').then((mod) => mod.default ?? mod)
  }
  return plotlyPromise
}

const BASE_CONFIG = { displaylogo: false, responsive: true, displayModeBar: false }

// Thin React wrapper around Plotly.react. Pass a memoized `onPointClick` to keep
// the click listener stable across renders.
function PlotlyChart({ data, layout, config, onPointClick, className, style }) {
  const ref = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadPlotly().then((Plotly) => {
      const el = ref.current
      if (cancelled || !el) {
        return
      }
      Plotly.react(el, data, layout, { ...BASE_CONFIG, ...config })
      if (onPointClick) {
        el.removeAllListeners?.('plotly_click')
        el.on('plotly_click', (event) => {
          const point = event?.points?.[0]
          if (point) {
            onPointClick(point)
          }
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [data, layout, config, onPointClick])

  // Purge the figure on unmount to release Plotly's resources.
  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) {
        loadPlotly().then((Plotly) => Plotly.purge(el))
      }
    }
  }, [])

  return <div ref={ref} className={className} style={{ width: '100%', ...style }} />
}

export default PlotlyChart
