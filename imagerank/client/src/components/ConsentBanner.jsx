import { useState } from 'react'
import Button from '@mui/material/Button'
import { Link } from 'react-router-dom'
import { loadAnalytics, setConsent, shouldAskConsent } from '../lib/consent'
import { useT, useTx } from '../lib/i18n'
import '../pages/pages.css'

// Asks before analytics runs, for visitors in the region that requires asking (see
// lib/consent.js). Rendered at the app root so it appears on every page.
//
// Declining is a plain button of equal weight, not a buried link: consent that is
// harder to refuse than to give is not freely given, which is the whole point of
// asking. Nothing is loaded from Google until Accept is pressed.
function ConsentBanner() {
  const t = useT()
  const tx = useTx()
  // Read once on mount. A visitor who has already answered never sees this, and the
  // answer is not something that changes underneath us mid-render.
  const [visible, setVisible] = useState(shouldAskConsent)

  if (!visible) {
    return null
  }

  function decide(decision) {
    setConsent(decision)
    if (decision === 'granted') {
      loadAnalytics()
    }
    setVisible(false)
  }

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={t('consent.label')}>
      <p className="consent-banner-copy">
        {tx('consent.body', {
          policy: (
            <Link className="consent-banner-link" to="/privacy">
              {t('privacy.link')}
            </Link>
          ),
        })}
      </p>
      <div className="consent-banner-actions">
        <Button variant="outlined" size="small" onClick={() => decide('denied')}>
          {t('consent.decline')}
        </Button>
        <Button variant="contained" size="small" onClick={() => decide('granted')}>
          {t('consent.accept')}
        </Button>
      </div>
    </div>
  )
}

export default ConsentBanner
