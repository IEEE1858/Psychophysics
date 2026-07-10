import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import '../pages/pages.css'

// Dependency-free info glyph (we don't ship @mui/icons-material).
function InfoGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="7.5" r="1.3" fill="currentColor" />
      <rect x="11" y="10.5" width="2" height="7" rx="1" fill="currentColor" />
    </svg>
  )
}

// Capitalize the first letter of a dataset category value ("nature" -> "Nature").
function cap(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

// FiveK license codes (from the sidecar) → the local license copy to link to
// (issue #41). filesAdobe.txt images use the Adobe license; filesAdobeMIT.txt
// images use the Adobe–MIT license.
const LICENSES = {
  Adobe: { label: 'Adobe Research License', href: '/licenses/LicenseAdobe.txt' },
  AdobeMIT: { label: 'Adobe–MIT Research License', href: '/licenses/LicenseAdobeMIT.txt' },
}

// The capture summary plus the scene categorization (issue #37), in display
// order. Each row is shown only when the source metadata carries that field.
// Subject / Light / Location come from the MIT-Adobe FiveK dataset; the rest is
// the original photo's EXIF.
function captureRows(exif) {
  if (!exif) {
    return []
  }
  const camera = [exif.make, exif.model].filter(Boolean).join(' ').trim()
  const dimensions = exif.width && exif.height ? `${exif.width} × ${exif.height}` : null
  return [
    ['Subject', cap(exif.subject)],
    ['Light', cap(exif.light)],
    ['Location', cap(exif.location)],
    ['Camera', camera || null],
    ['Lens', exif.lens],
    ['Focal length', exif.focalLength],
    ['Aperture', exif.fNumber],
    ['Shutter', exif.exposureTime],
    ['ISO', exif.iso != null ? String(exif.iso) : null],
    ['Date taken', exif.dateTaken],
    ['Dimensions', dimensions],
  ].filter(([, value]) => value != null && value !== '')
}

// An [i] button that reveals source information + a summary of the original
// (unprocessed) image's EXIF metadata. Used on the preview and grading pages.
// It deliberately shows only original-image metadata — never the current
// processing level or params — so it can't bias study judgments.
function ImageInfoButton({ image, collectionLabel }) {
  const [open, setOpen] = useState(false)
  if (!image) {
    return null
  }

  const rows = captureRows(image.exif)
  const license = image.exif?.license ? LICENSES[image.exif.license] : null

  return (
    <>
      <Tooltip title="Image information">
        <IconButton
          className="image-info-button"
          aria-label="Image information"
          size="small"
          onClick={() => setOpen(true)}
        >
          <InfoGlyph />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="image-info-title">
        <DialogTitle id="image-info-title">Image information</DialogTitle>
        <DialogContent>
          <dl className="image-info-list">
            <div className="image-info-row">
              <dt>Image</dt>
              <dd>{image.label ?? image.id}</dd>
            </div>
            {collectionLabel ? (
              <div className="image-info-row">
                <dt>Category</dt>
                <dd>{collectionLabel}</dd>
              </div>
            ) : null}
            {rows.map(([label, value]) => (
              <div className="image-info-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {license ? (
              <div className="image-info-row" key="License">
                <dt>License</dt>
                <dd>
                  <a href={license.href} target="_blank" rel="noopener noreferrer">
                    {license.label}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          {rows.length === 0 ? (
            <p className="image-info-empty">
              Source metadata is not available for this image.
            </p>
          ) : (
            <p className="image-info-note">
              Metadata describes the original, unprocessed source photograph.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ImageInfoButton
