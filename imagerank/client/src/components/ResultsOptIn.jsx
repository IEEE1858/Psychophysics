import { useState } from 'react'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import '../pages/pages.css'

// "Email me when the results are published" (issue #45), shown on the study
// completion screen. The address is stored separately from the demographics
// email — this is a distinct consent to be contacted, and the participant can
// withdraw it by clearing the box.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ResultsOptIn({ participantId, initialOptIn = false, initialEmail = '' }) {
  const [checked, setChecked] = useState(Boolean(initialOptIn))
  const [email, setEmail] = useState(initialEmail ?? '')
  // Whether an opt-in is currently recorded on the server, so unchecking the
  // box only sends a withdrawal when there is something to withdraw.
  const [savedOptIn, setSavedOptIn] = useState(Boolean(initialOptIn))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!participantId) {
    return null
  }

  async function save(optIn) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await axios.post(`/api/participants/${participantId}/results-opt-in`, {
        optIn,
        email: optIn ? email.trim() : '',
      })
      setSavedOptIn(optIn)
      setNotice(
        optIn
          ? 'Thank you — we will email you when the results are published.'
          : 'Removed. We will not email you about the results.',
      )
    } catch (requestError) {
      setError(requestError.response?.data?.error ?? 'Failed to save your preference.')
      // Put the box back where the server still has it, so the control keeps
      // telling the truth about what was recorded.
      setChecked(savedOptIn)
    } finally {
      setSaving(false)
    }
  }

  function handleToggle(event) {
    const next = event.target.checked
    setChecked(next)
    setError('')
    setNotice('')
    // Checking the box only reveals the address field — nothing is recorded
    // until they confirm it. Unchecking withdraws an opt-in straight away.
    if (!next && savedOptIn) {
      save(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    save(true)
  }

  return (
    <form className="results-optin" onSubmit={handleSubmit} noValidate>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={handleToggle} disabled={saving} />}
        label="Email me when the results of this study are published"
      />

      {checked ? (
        <div className="results-optin-row">
          <TextField
            label="Email address"
            type="email"
            size="small"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={saving}
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={saving || !email.trim()}>
            {saving ? 'Saving…' : savedOptIn ? 'Update' : 'Save'}
          </Button>
        </div>
      ) : null}

      {checked ? (
        <p className="results-optin-note">
          Used only to send you the study results. It is not shared with anyone else.
        </p>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}
    </form>
  )
}

export default ResultsOptIn
