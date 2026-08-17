// Analytics consent gating.
//
// GDPR treats analytics cookies as requiring opt-in *before* they are set, not merely
// disclosure afterwards. So the Google tag is no longer in index.html: nothing is
// requested from Google, and no cookie is set, until either consent is granted or we
// determine the visitor is outside the region that requires it.
//
// Where the visitor is, and why by time zone: the honest answer is that this is an
// approximation. A correct answer needs the client address resolved against a
// geo-IP database, which would mean shipping and maintaining one on the server (the
// address is already available there — see trust proxy in server/index.js). The time
// zone is a decent proxy, needs no network call and no new dependency, and errs in
// the safe direction: a traveller or VPN user outside the EEA who reads as inside
// simply gets asked for consent, which is never harmful. The reverse — an EEA
// resident whose clock says otherwise — is the case that matters, and is rare enough
// that this is a reasonable first step rather than a final one.
const MEASUREMENT_ID = 'G-49P1MRCD0E'

const STORAGE_KEY = 'analyticsConsent'

// EU + the rest of the EEA (Iceland, Liechtenstein, Norway), plus the UK, which has
// its own equivalent regime. Includes the Atlantic and African zones belonging to
// member states, which are covered too.
const CONSENT_REQUIRED_ZONES = new Set([
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Belfast',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Busingen',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Gibraltar',
  'Europe/Guernsey',
  'Europe/Helsinki',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/London',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Nicosia',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Reykjavik',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Sofia',
  'Europe/Stockholm',
  'Europe/Tallinn',
  'Europe/Vaduz',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Atlantic/Azores',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Reykjavik',
  'Africa/Ceuta',
  'Asia/Famagusta',
  'Asia/Nicosia',
  // French overseas departments, which are part of the EU.
  'America/Cayenne',
  'America/Guadeloupe',
  'America/Martinique',
  'Indian/Mayotte',
  'Indian/Reunion',
])

export function requiresConsent() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return CONSENT_REQUIRED_ZONES.has(zone)
  } catch {
    // If the zone cannot be read, assume consent is required. The costly mistake is
    // tracking someone who should have been asked, not asking someone who need not be.
    return true
  }
}

// 'granted' | 'denied' | null (not yet decided)
export function getConsent() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'granted' || stored === 'denied' ? stored : null
  } catch {
    return null
  }
}

// Removes the cookies GA sets. Needed because a visitor may already carry them from
// before this consent gate existed, or from a session where they accepted and have
// now declined; leaving them behind would keep identifying someone who said no.
// Cleared on the host and on the registrable domain, since GA sets them on the latter.
function clearAnalyticsCookies() {
  if (typeof document === 'undefined') {
    return
  }
  const names = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_') || name.startsWith('_gid'))

  const host = window.location.hostname
  const parts = host.split('.')
  const domains = [host, parts.length > 2 ? `.${parts.slice(-2).join('.')}` : `.${host}`]

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
    }
    document.cookie = `${name}=; Max-Age=0; path=/`
  }
}

export function setConsent(decision) {
  if (decision === 'denied') {
    clearAnalyticsCookies()
  }
  try {
    localStorage.setItem(STORAGE_KEY, decision)
  } catch {
    // A blocked storage is not a reason to fail; the visitor is simply asked again.
  }
}

let loaded = false

// Injects the tag. Idempotent, because it is called both at startup and from the
// banner, and a second gtag.js would double-count every page view.
export function loadAnalytics() {
  if (loaded || typeof document === 'undefined') {
    return
  }
  loaded = true

  window.dataLayer = window.dataLayer || []
  function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  gtag('js', new Date())
  gtag('config', MEASUREMENT_ID)
}

// Called once at startup. Loads analytics only where it is allowed to load without
// asking, or where it has already been allowed.
export function initAnalytics() {
  if (!requiresConsent() || getConsent() === 'granted') {
    loadAnalytics()
  }
}

// Whether the banner should be shown: only in the region that requires asking, and
// only until the visitor has answered.
export function shouldAskConsent() {
  return requiresConsent() && getConsent() === null
}
