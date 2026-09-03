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

// Human-readable elapsed time, shared by every admin view.
export function formatDuration(ms) {
  if (!ms) {
    return '—'
  }
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function formatDateTime(value) {
  if (!value) {
    return '—'
  }
  // Stored as UTC "YYYY-MM-DD HH:MM:SS"; render in the viewer's local time.
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

// The subject's email, or null when they took part as a guest. Older rows
// stored a skipped email as an empty string rather than NULL, so both count as
// "no email".
export function subjectEmail(participant) {
  const email = participant?.email ?? participant?.participant_email
  const trimmed = typeof email === 'string' ? email.trim() : ''
  return trimmed === '' ? null : trimmed
}

// A stable label for a subject. Guests never give an email, so they are
// identified by participant id (unique) with their recorded IP as context.
// Ranking rows carry the subject as `participant_id` and use `id` for the
// ranking itself, so that field wins where both are present.
export function subjectLabel(participant) {
  if (!participant) {
    return 'Unknown subject'
  }
  return subjectEmail(participant) ?? `Guest ${participant.participant_id ?? participant.id}`
}

// "L3 / 18" — a selected level shown against the image's max level.
export function formatLevel(level, maxLevel) {
  if (level == null) {
    return '—'
  }
  return maxLevel != null ? `L${level} / ${maxLevel}` : `L${level}`
}
