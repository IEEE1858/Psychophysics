import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import { localizedCountries } from '../lib/countries'
import { useI18n, useTx } from '../lib/i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'
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

// How long the study is assumed to run, in minutes, which sizes how many images the
// participant is shown (issue #19). Participants are no longer asked (issue #51), so
// this is an assumption we make on their behalf rather than an answer they gave — see
// the note where it is submitted.
const ASSUMED_TIME_BUDGET_MINUTES = 20

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
  // Recorded as 20 for every participant. Kept in the payload rather than dropped so
  // time_budget_minutes stays populated for the playlist sizing that reads it, but be
  // aware when analysing: for rows created from this point on it is a constant we
  // chose, not something the participant told us.
  timeBudgetMinutes: ASSUMED_TIME_BUDGET_MINUTES,
}

// Every field except visionDetails is always required; visionDetails is only
// required when the participant reports degraded vision ("Yes").
// Email is deliberately absent: it is optional (issue #49). It is still validated
// for format when supplied, and still required to create an account, which is
// checked at submit time rather than here.
const REQUIRED_FIELDS = [
  'age',
  'gender',
  'selfDescription',
  'visionStatus',
  'colorBlind',
  'countryOfOrigin',
  'displayType',
  'lighting',
]

// Returns translation *keys* rather than sentences, so validation can stay a plain
// function outside the component while the messages still follow the participant's
// language.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(demographics) {
  const errors = {}

  for (const field of REQUIRED_FIELDS) {
    if (!String(demographics[field]).trim()) {
      errors[field] = 'demo.error.required'
    }
  }

  if (demographics.email && !EMAIL_RE.test(demographics.email)) {
    errors.email = 'demo.error.email'
  }

  if (demographics.visionStatus === 'Yes' && !demographics.visionDetails.trim()) {
    errors.visionDetails = 'demo.error.visionDetails'
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
  const { language, t } = useI18n()
  const tx = useTx()
  const [searchParams] = useSearchParams()
  const isEditing = searchParams.get('edit') === '1'

  // 240 countries localized and re-collated; only worth redoing when the language
  // changes, not on every keystroke in the form.
  const countryOptions = useMemo(() => localizedCountries(language), [language])

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
      setAccountError(t('demo.error.password', { min: MIN_PASSWORD_LENGTH }))
      return
    }
    // An account is keyed by email, so a password without one cannot be honoured.
    // Caught here rather than in validate() because it depends on the password
    // field, and the participant can always clear the password and continue
    // anonymously instead.
    if (wantsAccount && !EMAIL_RE.test(demographics.email.trim())) {
      setErrors((previous) => ({ ...previous, email: 'demo.error.emailForAccount' }))
      setAccountError(t('demo.error.emailForAccount'))
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
              registerError.response?.data?.error || t('demo.error.account'),
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
      setSubmitError(t('demo.error.save'))
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (event) => updateField(event.target.name, event.target.value)

  return (
    <main className="page-shell">
      <section className="page-panel">
        <div className="site-topbar">
          <LanguageSwitcher />
        </div>

        <header className="preview-header">
          <Link className="back-link" to={isEditing ? '/study' : '/'}>
            {isEditing ? t('demo.backToStudy') : t('demo.back')}
          </Link>
          <p className="eyebrow">{isEditing ? t('demo.eyebrow.edit') : t('demo.eyebrow.before')}</p>
          <h1>{t('demo.title')}</h1>
          <p className="home-lead">{t('demo.lead')}</p>
        </header>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <TextField
              type="number"
              name="age"
              label={t('demo.age')}
              value={demographics.age}
              onChange={handleChange}
              error={Boolean(errors.age)}
              helperText={errors.age ? t(errors.age) : ''}
              fullWidth
              slotProps={{ htmlInput: { min: 0, max: 120 } }}
            />

            <SelectField
              label={t('demo.gender')}
              name="gender"
              value={demographics.gender}
              onChange={handleChange}
              error={errors.gender ? t(errors.gender) : ''}
              options={[
                { value: 'Female', label: t('demo.gender.female') },
                { value: 'Male', label: t('demo.gender.male') },
                { value: 'Non-binary', label: t('demo.gender.nonBinary') },
                { value: 'Prefer not to say', label: t('demo.gender.preferNotToSay') },
              ]}
            />

            <TextField
              type="email"
              name="email"
              label={t('demo.emailOptional')}
              placeholder={t('demo.emailPlaceholder')}
              value={demographics.email}
              onChange={handleChange}
              error={Boolean(errors.email)}
              helperText={errors.email ? t(errors.email) : ''}
              fullWidth
              className="form-full"
            />

            <SelectField
              label={t('demo.selfDescription')}
              name="selfDescription"
              value={demographics.selfDescription}
              onChange={handleChange}
              error={errors.selfDescription ? t(errors.selfDescription) : ''}
              full
              options={[
                { value: 'Regular person', label: t('demo.self.regular') },
                { value: 'Photographer / Imaging Expert', label: t('demo.self.expert') },
              ]}
            />

            <SelectField
              label={t('demo.visionStatus')}
              name="visionStatus"
              value={demographics.visionStatus}
              onChange={handleChange}
              error={errors.visionStatus ? t(errors.visionStatus) : ''}
              full
              options={[
                { value: 'No - Ordinary vision', label: t('demo.vision.ordinary') },
                {
                  value: 'No because of correction with glasses/contact lenses/surgery',
                  label: t('demo.vision.corrected'),
                },
                { value: 'Yes', label: t('demo.vision.yesDetails') },
              ]}
            />

            {isVisionYes ? (
              <TextField
                name="visionDetails"
                label={t('demo.visionDetails')}
                placeholder={t('demo.visionDetailsPlaceholder')}
                value={demographics.visionDetails}
                onChange={handleChange}
                error={Boolean(errors.visionDetails)}
                helperText={errors.visionDetails ? t(errors.visionDetails) : ''}
                fullWidth
                multiline
                minRows={3}
                className="form-full"
              />
            ) : null}

            <SelectField
              label={t('demo.colorBlind')}
              name="colorBlind"
              value={demographics.colorBlind}
              onChange={handleChange}
              error={errors.colorBlind ? t(errors.colorBlind) : ''}
              options={[
                { value: 'No', label: t('demo.no') },
                { value: 'Yes', label: t('demo.yes') },
              ]}
            />

            <SelectField
              label={t('demo.country')}
              name="countryOfOrigin"
              value={demographics.countryOfOrigin}
              onChange={handleChange}
              error={errors.countryOfOrigin ? t(errors.countryOfOrigin) : ''}
              // Localized labels, English values: the name written to the database
              // stays canonical so responses stay comparable across languages.
              options={countryOptions}
            />

            <SelectField
              label={t('demo.displayType')}
              name="displayType"
              value={demographics.displayType}
              onChange={handleChange}
              error={errors.displayType ? t(errors.displayType) : ''}
              options={[
                { value: 'Laptop', label: t('demo.display.laptop') },
                { value: 'External Monitor', label: t('demo.display.monitor') },
              ]}
            />

            <SelectField
              label={t('demo.lighting')}
              name="lighting"
              value={demographics.lighting}
              onChange={handleChange}
              error={errors.lighting ? t(errors.lighting) : ''}
              options={[
                { value: 'Dim Light', label: t('demo.lighting.dim') },
                { value: 'Normal Indoor Lighting', label: t('demo.lighting.indoor') },
                {
                  value: 'Outdoor Lighting (not recommended)',
                  label: t('demo.lighting.outdoor'),
                },
              ]}
            />

          </div>

          {!isEditing && EMAIL_RE.test(demographics.email.trim()) ? (
            <div className="account-optional">
              <h2>{t('demo.account.title')}</h2>
              <p>
                {tx('demo.account.body', {
                  googleLink: (
                    <Link className="preview-link" to="/signin">
                      {t('demo.account.google')}
                    </Link>
                  ),
                })}
              </p>
              <TextField
                type="password"
                name="accountPassword"
                label={t('demo.password')}
                value={accountPassword}
                onChange={(event) => {
                  setAccountPassword(event.target.value)
                  setAccountError('')
                }}
                error={Boolean(accountError)}
                helperText={accountError || t('demo.passwordHelp', { min: MIN_PASSWORD_LENGTH })}
                autoComplete="new-password"
                fullWidth
              />
            </div>
          ) : null}

          {submitAttempted && Object.keys(errors).length > 0 ? (
            <Alert severity="error">{t('demo.error.fix')}</Alert>
          ) : null}

          {submitError ? <Alert severity="error">{submitError}</Alert> : null}

          <div className="form-actions">
            <Button component={Link} to={isEditing ? '/study' : '/'} variant="outlined" disabled={saving}>
              {isEditing ? t('demo.cancel') : t('demo.backHome')}
            </Button>
            <Button type="submit" variant="contained" size="large" className="cta-button" disabled={saving}>
              {saving ? t('demo.saving') : isEditing ? t('demo.saveReturn') : t('demo.submit')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default DemographicsPage
