import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { COUNTRIES } from '../lib/countries'
import {
  demographicsFromServer,
  getParticipantId,
  getStoredDemographics,
  hasSession,
  setParticipantId,
  setStoredDemographics,
} from '../lib/session'
import { authHeader, getAuthToken, register } from '../lib/auth'
import './pages.css'

// Minimum length for the optional account password (matches the server rule).
const MIN_PASSWORD_LENGTH = 8

// How long the study can run, in minutes. The chosen value sizes how many
// images the participant is shown (issue #19).
const TIME_BUDGET_MIN = 15
const TIME_BUDGET_MAX = 45
const TIME_BUDGET_DEFAULT = 30

const INITIAL_DEMOGRAPHICS = {
  age: '',
  gender: '',
  email: '',
  selfDescription: '',
  visionStatus: '',
  visionDetails: '',
  colorBlind: '',
  countryOfOrigin: '',
  displayType: '',
  lighting: '',
  timeBudgetMinutes: TIME_BUDGET_DEFAULT,
}

// Every field except visionDetails is always required; visionDetails is only
// required when the participant reports degraded vision ("Yes").
const REQUIRED_FIELDS = [
  'age',
  'gender',
  'email',
  'selfDescription',
  'visionStatus',
  'colorBlind',
  'countryOfOrigin',
  'displayType',
  'lighting',
]

function validate(demographics) {
  const errors = {}

  for (const field of REQUIRED_FIELDS) {
    if (!String(demographics[field]).trim()) {
      errors[field] = 'Required'
    }
  }

  if (demographics.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demographics.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (demographics.visionStatus === 'Yes' && !demographics.visionDetails.trim()) {
    errors.visionDetails = 'Please provide details about your vision'
  }

  return errors
}

// A labelled MUI Select wired into the FormControl pattern, so each dropdown
// gets a floating label, error state, and helper text consistently.
function SelectField({ label, name, value, onChange, error, options, full }) {
  const labelId = `${name}-label`

  return (
    <FormControl fullWidth error={Boolean(error)} className={full ? 'form-full' : undefined}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select labelId={labelId} id={name} name={name} label={label} value={value} onChange={onChange}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {error ? <FormHelperText>{error}</FormHelperText> : null}
    </FormControl>
  )
}

function DemographicsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEditing = searchParams.get('edit') === '1'

  // In edit mode, prefill from whatever the participant previously entered.
  const [demographics, setDemographics] = useState(
    () => (isEditing && getStoredDemographics()) || INITIAL_DEMOGRAPHICS,
  )
  const [errors, setErrors] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  // Optional account creation (issue #31). Blank = continue anonymously.
  const [accountPassword, setAccountPassword] = useState('')
  const [accountError, setAccountError] = useState('')

  // A returning participant who already has a session and isn't explicitly
  // editing should skip this form and resume the study.
  useEffect(() => {
    if (hasSession() && !isEditing) {
      navigate('/study', { replace: true })
    }
  }, [isEditing, navigate])

  // When editing without locally-stored answers (e.g. another device), pull the
  // saved demographics from the server to prefill the form.
  useEffect(() => {
    if (!isEditing || getStoredDemographics()) {
      return
    }
    const participantId = getParticipantId()
    if (!participantId) {
      return
    }
    axios
      .get(`/api/participants/${participantId}`)
      .then((response) => setDemographics(demographicsFromServer(response.data.participant)))
      .catch(() => {})
  }, [isEditing])

  const isVisionYes = demographics.visionStatus === 'Yes'

  function updateField(name, value) {
    setDemographics((previous) => {
      const next = { ...previous, [name]: value }
      // Clear vision details when the participant is no longer reporting "Yes".
      if (name === 'visionStatus' && value !== 'Yes') {
        next.visionDetails = ''
      }
      return next
    })

    if (submitAttempted) {
      // Re-validate live once the participant has tried to submit.
      setErrors((previous) => {
        const next = { ...previous }
        delete next[name]
        return next
      })
    }
  }

  // Whether the participant opted into creating an account (typed a password)
  // and isn't already signed in.
  const wantsAccount = !isEditing && accountPassword.length > 0 && !getAuthToken()

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(demographics)
    setErrors(nextErrors)
    setSubmitAttempted(true)
    setSubmitError('')
    setAccountError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }
    if (wantsAccount && accountPassword.length < MIN_PASSWORD_LENGTH) {
      setAccountError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    setSaving(true)
    try {
      const participantId = getParticipantId()
      if (isEditing && participantId) {
        // Update the existing session's demographics.
        await axios.put(`/api/participants/${participantId}`, demographics)
      } else {
        // Create the optional account first so the participant we create next is
        // owned by it (the server reads the Bearer token). If the email is taken
        // we stop here — no participant is created — so the visitor can fix it or
        // clear the password and continue anonymously.
        if (wantsAccount) {
          try {
            await register(demographics.email.trim(), accountPassword)
          } catch (registerError) {
            setAccountError(
              registerError.response?.data?.error ||
                'Could not create your account. Please try again.',
            )
            setSaving(false)
            return
          }
        }
        // Create the participant record (the persistent session); the returned
        // id ties the study's image rankings back to these demographics. When
        // signed in, authHeader() links the row to the account.
        const response = await axios.post('/api/participants', demographics, {
          headers: authHeader(),
        })
        setParticipantId(response.data.participantId)
      }
      setStoredDemographics(demographics)
      // Return to the study — it resumes wherever the participant left off.
      navigate('/study')
    } catch (error) {
      console.error('Failed to save demographics', error)
      setSubmitError('We could not save your responses. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (event) => updateField(event.target.name, event.target.value)

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header">
          <Link className="back-link" to={isEditing ? '/study' : '/'}>
            {isEditing ? '← Back to the study' : '← Back to home'}
          </Link>
          <p className="eyebrow">{isEditing ? 'Edit your details' : 'Before you begin'}</p>
          <h1>About you</h1>
          <p className="home-lead">
            A few questions about you and your viewing setup. This helps us interpret the results.
            All fields are required.
          </p>
        </header>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <TextField
              type="number"
              name="age"
              label="Age"
              value={demographics.age}
              onChange={handleChange}
              error={Boolean(errors.age)}
              helperText={errors.age}
              fullWidth
              slotProps={{ htmlInput: { min: 0, max: 120 } }}
            />

            <SelectField
              label="Gender"
              name="gender"
              value={demographics.gender}
              onChange={handleChange}
              error={errors.gender}
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Non-binary', label: 'Non-binary' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
            />

            <TextField
              type="email"
              name="email"
              label="Email"
              placeholder="you@example.com"
              value={demographics.email}
              onChange={handleChange}
              error={Boolean(errors.email)}
              helperText={errors.email}
              fullWidth
              className="form-full"
            />

            <SelectField
              label="How would you describe yourself?"
              name="selfDescription"
              value={demographics.selfDescription}
              onChange={handleChange}
              error={errors.selfDescription}
              full
              options={[
                { value: 'Regular person', label: 'Regular person' },
                { value: 'Photographer / Imaging Expert', label: 'Photographer / Imaging Expert' },
              ]}
            />

            <SelectField
              label="Is your vision degraded?"
              name="visionStatus"
              value={demographics.visionStatus}
              onChange={handleChange}
              error={errors.visionStatus}
              full
              options={[
                { value: 'No - Ordinary vision', label: 'No - Ordinary vision' },
                {
                  value: 'No because of correction with glasses/contact lenses/surgery',
                  label: 'No because of correction with glasses/contact lenses/surgery',
                },
                { value: 'Yes', label: 'Yes, provide details' },
              ]}
            />

            {isVisionYes ? (
              <TextField
                name="visionDetails"
                label="Vision details"
                placeholder="Provide details about your vision."
                value={demographics.visionDetails}
                onChange={handleChange}
                error={Boolean(errors.visionDetails)}
                helperText={errors.visionDetails}
                fullWidth
                multiline
                minRows={3}
                className="form-full"
              />
            ) : null}

            <SelectField
              label="Color blindness?"
              name="colorBlind"
              value={demographics.colorBlind}
              onChange={handleChange}
              error={errors.colorBlind}
              options={[
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
              ]}
            />

            <SelectField
              label="Country of origin"
              name="countryOfOrigin"
              value={demographics.countryOfOrigin}
              onChange={handleChange}
              error={errors.countryOfOrigin}
              options={COUNTRIES.map((country) => ({ value: country, label: country }))}
            />

            <SelectField
              label="What kind of display?"
              name="displayType"
              value={demographics.displayType}
              onChange={handleChange}
              error={errors.displayType}
              options={[
                { value: 'Laptop', label: 'Laptop' },
                { value: 'External Monitor', label: 'External Monitor' },
              ]}
            />

            <SelectField
              label="What kind of lighting?"
              name="lighting"
              value={demographics.lighting}
              onChange={handleChange}
              error={errors.lighting}
              options={[
                { value: 'Dim Light', label: 'Dim Light' },
                { value: 'Normal Indoor Lighting', label: 'Normal Indoor Lighting' },
                { value: 'Outdoor Lighting (not recommended)', label: 'Outdoor Lighting (not recommended)' },
              ]}
            />

            <div className="form-full time-budget-field">
              <Typography component="label" id="time-budget-label" className="time-budget-label">
                How much time do you have to review images?
              </Typography>
              <p className="time-budget-help">
                We will show you about as many images as fit in this time — you can always stop early
                or ask for more at the end.
              </p>
              <Slider
                aria-labelledby="time-budget-label"
                value={Number(demographics.timeBudgetMinutes) || TIME_BUDGET_DEFAULT}
                onChange={(_, value) => updateField('timeBudgetMinutes', value)}
                min={TIME_BUDGET_MIN}
                max={TIME_BUDGET_MAX}
                step={5}
                marks
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${value} min`}
              />
            </div>
          </div>

          {!isEditing ? (
            <div className="account-optional">
              <h2>Save your progress across devices (optional)</h2>
              <p>
                Set a password to create an account tied to the email above, then sign in on
                another computer to pick up where you left off. Leave this blank to continue
                without an account. Prefer Google?{' '}
                <Link className="preview-link" to="/signin">
                  Sign in with Google
                </Link>
                .
              </p>
              <TextField
                type="password"
                name="accountPassword"
                label="Create a password (optional)"
                value={accountPassword}
                onChange={(event) => {
                  setAccountPassword(event.target.value)
                  setAccountError('')
                }}
                error={Boolean(accountError)}
                helperText={accountError || `At least ${MIN_PASSWORD_LENGTH} characters.`}
                autoComplete="new-password"
                fullWidth
              />
            </div>
          ) : null}

          {submitAttempted && Object.keys(errors).length > 0 ? (
            <Alert severity="error">Please correct the highlighted fields before continuing.</Alert>
          ) : null}

          {submitError ? <Alert severity="error">{submitError}</Alert> : null}

          <div className="form-actions">
            <Button component={Link} to={isEditing ? '/study' : '/'} variant="outlined" disabled={saving}>
              {isEditing ? 'Cancel' : 'Back to home'}
            </Button>
            <Button type="submit" variant="contained" size="large" className="cta-button" disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Save and return to study' : 'Continue to the study'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default DemographicsPage
