import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import '../pages/pages.css'

// "Help us find more participants" (issue #46): share links for the study, on
// the home page and on the completion screen. The study needs a lot of eyes,
// and a participant who just finished is the most likely person to recruit the
// next one.

// The canonical public address of the study. Sharing the dev origin would hand
// someone a link they cannot open, so localhost falls back to the real URL.
const CANONICAL_URL = 'https://imagerank.imatest.com'

// Remembered so someone who shares to Mastodon twice only types their instance
// once (there is no central Mastodon share endpoint to post to).
const MASTODON_INSTANCE_KEY = 'mastodonInstance'

const SHARE_TITLE = 'Which photo do you like best — and which one looks real?'
const SHARE_TEXT =
  'Which photo do you like best — and which one looks real? They are often not the same image. ' +
  'The IEEE 1858 imaging standards group is measuring that gap, and needs people to look at ' +
  'photos and choose. 15–45 minutes on a laptop, no expertise required.'

// X counts every URL as 23 characters against its 280-character limit, which
// leaves the full text with no room for the sharer to add a word of their own.
const SHORT_SHARE_TEXT =
  'Which photo do you like best — and which one looks real? Often not the same image. ' +
  'The IEEE 1858 imaging standards group is measuring that gap. 15–45 minutes on a laptop, ' +
  'no expertise needed.'

function studyUrl() {
  const origin = window.location.origin
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(origin) ? CANONICAL_URL : origin
}

// Strip anything that isn't a bare hostname, so a pasted "https://mas.to/@me"
// still resolves to the instance's share endpoint.
function normalizeInstance(value) {
  return String(value)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^@/, '')
}

// Dependency-free glyphs (we don't ship @mui/icons-material). They sit beside
// text labels, so they only need to read as the brand at a glance.
function EmailGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m3.5 7 8.5 6 8.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15.5 7h-1.7C12.5 7 12 7.9 12 9v1.6h-1.7v2.5H12V21h2.6v-7.9h1.9l.4-2.5h-2.3V9.4c0-.5.2-.8.8-.8h1.5z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function XGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4.5 19 19.5M19 4.5 5 19.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function BlueskyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 10.6C10.6 8 7.7 5 5.5 5 4 5 3 6.2 3 8.3c0 2.2.6 5 2.5 5.8.9.4 2.1.4 3.2 0-1.2.9-1.7 2-1.1 2.9.7 1 2.2.9 3.2-.4.5-.7.9-1.5 1.2-2.3.3.8.7 1.6 1.2 2.3 1 1.3 2.5 1.4 3.2.4.6-.9.1-2-1.1-2.9 1.1.4 2.3.4 3.2 0 1.9-.8 2.5-3.6 2.5-5.8C21 6.2 20 5 18.5 5c-2.2 0-5.1 3-6.5 5.6z"
        fill="currentColor"
      />
    </svg>
  )
}

function MastodonGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.2c4.3 0 6.8 2 6.8 6.3 0 3-.2 5-1.4 6-1.5 1.3-4.6 1.5-7 1.3v-1.9c2.2.2 4.7.2 5.6-.6.6-.6.7-2 .7-4.4 0-3-1.4-4.3-4.7-4.3S7.3 6.9 7.3 9.9c0 2.9.3 4.9 1.4 6 1.3 1.3 3.7 1.6 6.5 1.4v2c-3.4.3-6.4-.3-8-2.1-1.5-1.7-2-4.3-2-7.7 0-4.3 2.5-6.3 6.8-6.3z"
        fill="currentColor"
      />
      <path
        d="M9.4 13V9.9c0-1 .6-1.6 1.5-1.6.7 0 1.2.4 1.5 1.1l.2.4.2-.4c.3-.7.8-1.1 1.5-1.1.9 0 1.5.6 1.5 1.6V13h-1.4v-2.9c0-.4-.2-.6-.5-.6-.3 0-.5.2-.6.6l-.5 1.4h-.9l-.5-1.4c-.1-.4-.3-.6-.6-.6-.3 0-.5.2-.5.6V13z"
        fill="currentColor"
      />
    </svg>
  )
}

function LinkGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 7M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7L12.5 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShareStudy({
  title = 'Help us find more participants',
  blurb = 'The more people who take part, the better the results. Pass the study on:',
  className = '',
}) {
  const [mastodonOpen, setMastodonOpen] = useState(false)
  const [instance, setInstance] = useState(() => localStorage.getItem(MASTODON_INSTANCE_KEY) ?? '')
  const [status, setStatus] = useState('')

  const url = studyUrl()
  const message = `${SHARE_TEXT}\n\n${url}`

  function openShare(target) {
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  function shareToMastodon() {
    const host = normalizeInstance(instance)
    if (!host) {
      return
    }
    localStorage.setItem(MASTODON_INSTANCE_KEY, host)
    setMastodonOpen(false)
    openShare(`https://${host}/share?text=${encodeURIComponent(message)}`)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus(`Link copied: ${url}`)
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) — show
      // the link so it can still be copied by hand.
      setStatus(`Copy this link: ${url}`)
    }
  }

  return (
    <section className={`share-block ${className}`.trim()}>
      <h2 className="share-title">{title}</h2>
      <p className="share-blurb">{blurb}</p>

      <div className="share-buttons">
        <Button
          variant="outlined"
          size="small"
          startIcon={<EmailGlyph />}
          href={`mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(message)}`}
        >
          Email
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FacebookGlyph />}
          onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
        >
          Facebook
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<XGlyph />}
          onClick={() =>
            openShare(
              `https://x.com/intent/post?text=${encodeURIComponent(SHORT_SHARE_TEXT)}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          X
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<BlueskyGlyph />}
          onClick={() => openShare(`https://bsky.app/intent/compose?text=${encodeURIComponent(message)}`)}
        >
          Bluesky
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<MastodonGlyph />}
          onClick={() => setMastodonOpen(true)}
        >
          Mastodon
        </Button>
        <Button variant="outlined" size="small" startIcon={<LinkGlyph />} onClick={copyLink}>
          Copy link
        </Button>
      </div>

      {status ? <p className="share-status">{status}</p> : null}

      <Dialog open={mastodonOpen} onClose={() => setMastodonOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Share on Mastodon</DialogTitle>
        <DialogContent>
          <p className="share-dialog-copy">
            Mastodon has no central share page, so we need the server you post from.
          </p>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Your Mastodon server"
            placeholder="mastodon.social"
            value={instance}
            onChange={(event) => setInstance(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                shareToMastodon()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMastodonOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={shareToMastodon} disabled={!normalizeInstance(instance)}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}

export default ShareStudy
