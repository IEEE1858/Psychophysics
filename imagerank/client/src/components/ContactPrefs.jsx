import { useState } from 'react'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import { useT } from '../lib/i18n'
import '../pages/pages.css'

// "Stay in touch" (issue #45), shown on the study completion screen: an opt-in
// for the results of this study and one for taking part in future studies. The
// address is stored separately from the demographics email — these are distinct
// consents to be contacted, and either can be withdrawn by clearing its box.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function describe({ results, futureStudies }, t) {
  if (results && futureStudies) {
    return t('contact.savedBoth')
  }
  if (results) {
    return t('contact.savedResults')
  }
  if (futureStudies) {
    return t('contact.savedFuture')
  }
  return t('contact.savedNone')
}

function ContactPrefs({
  participantId,
  initialResults = false,
  initialFutureStudies = false,
  initialEmail = '',
}) {
  const t = useT()
  const [results, setResults] = useState(Boolean(initialResults))
  const [futureStudies, setFutureStudies] = useState(Boolean(initialFutureStudies))
  const [email, setEmail] = useState(initialEmail ?? '')
  // What the server currently holds, so the form can tell whether there are
  // unsaved changes and whether unchecking a box withdraws something real.
  const [saved, setSaved] = useState({
    results: Boolean(initialResults),
    futureStudies: Boolean(initialFutureStudies),
    email: initialEmail ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!participantId) {
    return null
  }

  const anyChecked = results || futureStudies
  const dirty =
    results !== saved.results
    || futureStudies !== saved.futureStudies
    || (anyChecked && email.trim() !== saved.email)

  async function save(next) {
    setSaving(true)
    setError('')
    setNotice('')
    const payload = { ...next, email: next.results || next.futureStudies ? email.trim() : '' }
    try {
      await axios.post(`/api/participants/${participantId}/contact-preferences`, payload)
      setSaved({ ...next, email: payload.email })
      setNotice(describe(next, t))
    } catch (requestError) {
      setError(requestError.response?.data?.error ?? t('contact.errorSave'))
      // Put the boxes back where the server still has them, so the form keeps
      // telling the truth about what was recorded.
      setResults(saved.results)
      setFutureStudies(saved.futureStudies)
    } finally {
      setSaving(false)
    }
  }

  // Checking a box only reveals the address field — nothing is recorded until
  // they confirm it. Clearing the last box withdraws consent straight away,
  // since a withdrawal should never wait on a second click.
  function toggle(key, value) {
    const next = { results, futureStudies, [key]: value }
    setResults(next.results)
    setFutureStudies(next.futureStudies)
    setError('')
    setNotice('')
    if (!next.results && !next.futureStudies && (saved.results || saved.futureStudies)) {
      save(next)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('contact.errorEmail'))
      return
    }
    save({ results, futureStudies })
  }

  return (
    <form className="contact-prefs" onSubmit={handleSubmit} noValidate>
      <p className="contact-prefs-title">{t('contact.title')}</p>

      <FormControlLabel
        control={
          <Checkbox
            checked={results}
            onChange={(event) => toggle('results', event.target.checked)}
            disabled={saving}
          />
        }
        label={t('contact.results')}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={futureStudies}
            onChange={(event) => toggle('futureStudies', event.target.checked)}
            disabled={saving}
          />
        }
        label={t('contact.futureStudies')}
      />

      {anyChecked ? (
        <>
          <div className="contact-prefs-row">
            <TextField
              label={t('contact.emailLabel')}
              type="email"
              size="small"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={saving}
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={saving || !email.trim() || !dirty}>
              {saving ? t('contact.saving') : saved.results || saved.futureStudies ? t('contact.update') : t('contact.save')}
            </Button>
          </div>
          <p className="contact-prefs-note">
            Used only to contact you about what you ticked above. It is not shared with anyone else.
          </p>
        </>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}
    </form>
  )
}

export default ContactPrefs
