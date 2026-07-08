// Shared theming + formatting for the admin analytics pages (issue #24).

// Distinct, accessible colors so the two image types read clearly apart on the
// shared realism-vs-favorite scatter and overlaid histograms.
export const COLLECTION_COLORS = {
  sharpness: '#287271', // teal (matches the app's primary accent)
  hdr: '#e76f51', // warm coral
}

export function collectionColor(collectionId) {
  return COLLECTION_COLORS[collectionId] ?? '#1d3557'
}

export const PLOT_FONT = {
  family: 'Inter, system-ui, -apple-system, sans-serif',
  color: '#455168',
  size: 12,
}

// A transparent-background layout that blends into the page panels.
export function baseLayout(overrides = {}) {
  return {
    font: PLOT_FONT,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 56, r: 16, t: 16, b: 48 },
    autosize: true,
    ...overrides,
  }
}

// Round a stat for display; em dash for missing values.
export function formatStat(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—'
  }
  return Number(value).toFixed(digits)
}
