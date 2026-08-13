import { useState } from 'react'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { LANGUAGES, languageLabel, useI18n } from '../lib/i18n'
import '../pages/pages.css'

// The globe the issue asks for. Drawn inline rather than pulled from
// @mui/icons-material, which this client does not depend on (see the share glyphs,
// which are inline for the same reason).
function GlobeGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.4 9h17.2M3.4 15h17.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CaretGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Language picker (issue #50). It names the current language rather than showing a
// bare globe: an unlabelled icon inside the page content was missed entirely, and a
// visitor who needs another language is exactly the visitor least able to guess
// what an icon means.
function LanguageSwitcher({ className = '', variant = 'light' }) {
  const { language, setLanguage, t } = useI18n()
  const [anchorEl, setAnchorEl] = useState(null)

  const current = LANGUAGES.find((entry) => entry.code === language)

  function choose(code) {
    setLanguage(code)
    setAnchorEl(null)
  }

  return (
    <>
      <Button
        className={`language-button language-button-${variant} ${className}`.trim()}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={t('lang.choose')}
        aria-haspopup="menu"
        startIcon={<GlobeGlyph />}
        endIcon={<CaretGlyph />}
        size="small"
      >
        <span className="language-button-text" lang={language}>
          {current?.native ?? t('lang.label')}
        </span>
      </Button>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {LANGUAGES.map((entry) => (
          <MenuItem
            key={entry.code}
            selected={entry.code === language}
            onClick={() => choose(entry.code)}
            // Each row reads in its own language, so the label is marked as such for
            // assistive technology and so the browser picks a font that can render it.
            lang={entry.code}
          >
            {languageLabel(entry.code)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default LanguageSwitcher
