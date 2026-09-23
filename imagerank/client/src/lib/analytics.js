// Shared theming + formatting for the admin analytics pages (issue #24).

import { useEffect, useMemo, useState } from 'react'

// Distinct, accessible colors so the two image types read clearly apart on the
// shared realism-vs-favorite scatter and overlaid histograms.
export const COLLECTION_COLORS = {
  sharpness: '#287271', // teal (matches the app's primary accent)
  hdr: '#e76f51', // warm coral
}

export function collectionColor(collectionId) {
  return COLLECTION_COLORS[collectionId] ?? '#1d3557'
}

// The expert/layperson breakdown group gets its own fixed colors,
// independent of the general group palette below, so it reads consistently
// wherever imaging expertise shows up.
const EXPERTISE_COLORS = { expert: '#e76f51', layperson: '#287271' }

// Palette for a demographic-breakdown chart's groups, which can run past two
// (e.g. four genders, three vision-degradation answers). Cycles if a
// dimension somehow has more distinct values than colors.
const GROUP_COLOR_PALETTE = [
  '#287271', '#e76f51', '#2a9d8f', '#e9c46a', '#264653',
  '#f4a261', '#8ab17d', '#c1666b', '#6d597a', '#457b9d',
]

export function groupColor(key, index) {
  if (key === 'expert' || key === 'layperson') {
    return EXPERTISE_COLORS[key]
  }
  return GROUP_COLOR_PALETTE[index % GROUP_COLOR_PALETTE.length]
}

// The demographic dimensions with their own breakdown page
// (/admin/analytics/<slug>), each grouping subjects by one field. Linked from
// the main analytics page; a second dimension for cross-tab comparison is a
// planned follow-up (each page currently groups by exactly one variable).
export const DEMOGRAPHIC_DIMENSIONS = [
  { slug: 'gender', label: 'Gender' },
  { slug: 'lighting', label: 'Lighting condition' },
  { slug: 'display', label: 'Display type' },
  { slug: 'country', label: 'Country' },
  { slug: 'imaging-expert', label: 'Imaging expertise' },
  { slug: 'color-blindness', label: 'Color blindness' },
  { slug: 'vision-degredation', label: 'Vision degradation' },
]

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

// Shared filter state for the admin analytics pages (the main dashboard and
// each per-dimension breakdown page), so a filter added once behaves
// identically everywhere it applies.

export const EMPTY_FILTERS = {
  ageMin: '',
  ageMax: '',
  genders: [],
  countries: [],
  visionStatuses: [],
  expertise: [],
  displayTypes: [],
  lightingConditions: [],
  colorBlind: [],
}

export function emptyFilterOptions() {
  return {
    genders: [],
    countries: [],
    visionStatuses: [],
    displayTypes: [],
    lightingConditions: [],
    colorBlind: [],
  }
}

// Debounce a fast-changing value (e.g. an age text field) so it only settles
// `delay` ms after the user stops typing, instead of firing a request per key.
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Filter state + the derived query params sent to the analytics endpoints.
// Shared by every page so the same filters mean the same thing everywhere.
export function useAnalyticsFilters() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // Age is a free-typed text field, so debounce it; the multi-selects fire on
  // pick and don't need one.
  const ageMin = useDebounced(filters.ageMin, 400)
  const ageMax = useDebounced(filters.ageMax, 400)

  const queryParams = useMemo(
    () => ({
      ageMin: ageMin || undefined,
      ageMax: ageMax || undefined,
      gender: filters.genders.length ? filters.genders.join(',') : undefined,
      country: filters.countries.length ? filters.countries.join(',') : undefined,
      vision: filters.visionStatuses.length ? filters.visionStatuses.join(',') : undefined,
      expertise: filters.expertise.length ? filters.expertise.join(',') : undefined,
      displayType: filters.displayTypes.length ? filters.displayTypes.join(',') : undefined,
      lighting: filters.lightingConditions.length ? filters.lightingConditions.join(',') : undefined,
      colorBlind: filters.colorBlind.length ? filters.colorBlind.join(',') : undefined,
    }),
    [
      ageMin,
      ageMax,
      filters.genders,
      filters.countries,
      filters.visionStatuses,
      filters.expertise,
      filters.displayTypes,
      filters.lightingConditions,
      filters.colorBlind,
    ],
  )

  const hasActiveFilters =
    Boolean(filters.ageMin) ||
    Boolean(filters.ageMax) ||
    filters.genders.length > 0 ||
    filters.countries.length > 0 ||
    filters.visionStatuses.length > 0 ||
    filters.expertise.length > 0 ||
    filters.displayTypes.length > 0 ||
    filters.lightingConditions.length > 0 ||
    filters.colorBlind.length > 0

  return { filters, setFilters, queryParams, paramsKey: JSON.stringify(queryParams), hasActiveFilters }
}

// "L3 / 18" — a selected level shown against the image's max level.
export function formatLevel(level, maxLevel) {
  if (level == null) {
    return '—'
  }
  return maxLevel != null ? `L${level} / ${maxLevel}` : `L${level}`
}
