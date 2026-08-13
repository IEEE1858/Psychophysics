import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import { LANGUAGES, languageLabel, useI18n } from '../lib/i18n'
import '../pages/pages.css'

// The globe the issue asks for. Drawn inline rather than pulled from
// @mui/icons-material, which this client does not depend on (see the share glyphs,
// which are inline for the same reason).
function GlobeGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.4 9h17.2M3.4 15h17.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useI18n()
  const [anchorEl, setAnchorEl] = useState(null)

  function choose(code) {
    setLanguage(code)
    setAnchorEl(null)
  }

  return (
    <>
      <Tooltip title={t('lang.label')}>
        <IconButton
          className={`language-button ${className}`.trim()}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={t('lang.choose')}
          aria-haspopup="menu"
        >
          <GlobeGlyph />
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {LANGUAGES.map((entry) => (
          <MenuItem
            key={entry.code}
            selected={entry.code === language}
            onClick={() => choose(entry.code)}
            // Each row reads in its own language, so the label is marked as such for
            // screen readers and so the browser picks a font that can render it.
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
