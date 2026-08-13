import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useI18n, withLanguageParam } from '../lib/i18n'
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

// The post text lives in the locale files, so a shared link is pitched in the
// sharer's language (keys share.subject / share.text).
//
// One text serves every platform, including X. X counts every URL as 23 characters
// against its 280-character limit, so a translation has to stay under 257 to leave
// the sharer room; the longest of the twelve currently sits at 256. A separate
// shortened variant used to exist for X and is no longer needed — if a future
// rewording pushes a locale past that budget, shorten that locale rather than
// reintroducing a second string to keep in sync.

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

function ShareStudy({ title, blurb, className = '' }) {
  const { language, t } = useI18n()
  const [mastodonOpen, setMastodonOpen] = useState(false)
  const [instance, setInstance] = useState(() => localStorage.getItem(MASTODON_INSTANCE_KEY) ?? '')
  const [status, setStatus] = useState('')

  const heading = title ?? t('share.title')
  const description = blurb ?? t('share.blurb')

  // Both the post text and the link carry the sharer's language (issue #50), so a
  // recruit opens the study already reading the language they were pitched in.
  const url = withLanguageParam(studyUrl(), language)
  const shareText = t('share.text')
  const message = `${shareText}\n\n${url}`

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
      setStatus(t('share.copied', { url }))
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) — show
      // the link so it can still be copied by hand.
      setStatus(t('share.copyManually', { url }))
    }
  }

  return (
    <section className={`share-block ${className}`.trim()}>
      <h2 className="share-title">{heading}</h2>
      <p className="share-blurb">{description}</p>

      <div className="share-buttons">
        <Button
          variant="outlined"
          size="small"
          startIcon={<EmailGlyph />}
          href={`mailto:?subject=${encodeURIComponent(t('share.subject'))}&body=${encodeURIComponent(message)}`}
        >
          {t('share.email')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FacebookGlyph />}
          onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
        >
          {t('share.facebook')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<XGlyph />}
          onClick={() =>
            openShare(
              `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          {t('share.twitter')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<BlueskyGlyph />}
          onClick={() => openShare(`https://bsky.app/intent/compose?text=${encodeURIComponent(message)}`)}
        >
          {t('share.bluesky')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<MastodonGlyph />}
          onClick={() => setMastodonOpen(true)}
        >
          {t('share.mastodon')}
        </Button>
        <Button variant="outlined" size="small" startIcon={<LinkGlyph />} onClick={copyLink}>
          {t('share.copyLink')}
        </Button>
      </div>

      {status ? <p className="share-status">{status}</p> : null}

      <Dialog open={mastodonOpen} onClose={() => setMastodonOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('share.mastodon.dialogTitle')}</DialogTitle>
        <DialogContent>
          <p className="share-dialog-copy">{t('share.mastodon.help')}</p>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t('share.mastodon.instanceLabel')}
            placeholder={t('share.mastodon.placeholder')}
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
          <Button onClick={() => setMastodonOpen(false)}>{t('share.mastodon.cancel')}</Button>
          <Button variant="contained" onClick={shareToMastodon} disabled={!normalizeInstance(instance)}>
            {t('share.mastodon.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}

export default ShareStudy
