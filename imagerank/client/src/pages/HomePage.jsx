import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { findCollection, useLibrary } from '../lib/useLibrary'
import { useIsMobile } from '../lib/useIsMobile'
import { sampleRandom, thumbnailFor } from '../lib/sample'
import { hasSession } from '../lib/session'
import { useAuth } from '../lib/auth'
import './pages.css'

const EXAMPLE_COUNT = 6

function ExampleGallery({ title, blurb, images, previewTo, previewLabel }) {
  return (
    <div className="example-group">
      <div className="example-group-head">
        <h3>{title}</h3>
        <p>{blurb}</p>
      </div>

      <div className="example-grid">
        {images.map((image) => (
          <figure key={image.id} className="example-tile">
            <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
          </figure>
        ))}
      </div>

      <Link className="preview-link" to={previewTo}>
        {previewLabel} →
      </Link>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { library, loading, error } = useLibrary()
  const { account, authed, signOut } = useAuth()

  const hdrCollection = findCollection(library, 'hdr')
  const sharpnessCollection = findCollection(library, 'sharpness')

  // Re-sample only when the underlying image lists change, so the examples stay
  // stable while the visitor reads the page.
  const hdrExamples = useMemo(
    () => sampleRandom(hdrCollection?.images ?? [], EXAMPLE_COUNT),
    [hdrCollection],
  )
  const sharpnessExamples = useMemo(
    () => sampleRandom(sharpnessCollection?.images ?? [], EXAMPLE_COUNT),
    [sharpnessCollection],
  )

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="home-hero">
          <div className="home-hero-text">
            <p className="eyebrow">IEEE 1858 · Psychophysics Study</p>
            <h1>Image Rank</h1>
            <p className="home-lead">
              This study explores how <strong>sharpening</strong> and <strong>HDR</strong> image
              processing change the way a photo is perceived. You will review the same image
              rendered at several different levels of processing and choose the version that is your
              <strong> favorite</strong> and the version that looks the{' '}
              <strong>most realistic</strong>.
            </p>
            <p className="home-lead">
              These two choices need not be the same — the most realistic image is not always the
              one that looks the most polished, and that tension is exactly what we are measuring.
            </p>
          </div>

          <div className="home-hero-cta">
            {isMobile ? (
              <Alert severity="info" className="mobile-gate">
                <strong>Please switch to a desktop or laptop computer.</strong>
                <span>
                  Accurate viewing requires a larger screen in indoor lighting conditions. Open this
                  page (<code>imagerank.imatest.com</code>) on your desktop or laptop to take part in
                  the study.
                </span>
              </Alert>
            ) : (
              <div className="cta-block">
                <p className="cta-note">
                  For consistent results, please take the study on a desktop or laptop computer in
                  indoor lighting conditions.
                </p>
                <Button
                  variant="contained"
                  size="large"
                  className="cta-button"
                  onClick={() => navigate(hasSession() ? '/study' : '/demographics')}
                >
                  {hasSession() ? 'Resume the Study' : 'Start the Study'}
                </Button>

                {authed ? (
                  <p className="cta-note">
                    Signed in as <strong>{account.email}</strong>.{' '}
                    <button type="button" className="link-button" onClick={signOut}>
                      Sign out
                    </button>
                  </p>
                ) : (
                  <p className="cta-note">
                    Have an account, or want to continue on another device?{' '}
                    <Link className="preview-link" to="/signin">
                      Sign in
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="examples">
          <h2 className="section-title">Example Images</h2>
          <p className="section-subtitle">
            A sample of the images you will rank. Browse the full set before you begin.
          </p>

          {loading ? (
            <div className="home-status">
              <CircularProgress size={28} />
              <span>Loading example images…</span>
            </div>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !error ? (
            <div className="examples-columns">
              <ExampleGallery
                title="HDR"
                blurb="High-dynamic-range tone mapping across processing levels."
                images={hdrExamples}
                previewTo="/preview/hdr"
                previewLabel="Preview HDR images"
              />
              <ExampleGallery
                title="Sharpness"
                blurb="Unsharp-mask sharpening across processing levels."
                images={sharpnessExamples}
                previewTo="/preview/sharpness"
                previewLabel="Preview Sharpness images"
              />
            </div>
          ) : null}
        </section>

        <section className="about-study">
          <h2 className="section-title">Who is conducting this study?</h2>
          <p className="about-body">
            This study is run by the{' '}
            <a
              className="about-link"
              href="https://sagroups.ieee.org/1858/"
              target="_blank"
              rel="noopener noreferrer"
            >
              IEEE 1858 Camera Perceptual Image Quality
            </a>{' '}
            working group — a group of imaging engineers and researchers who develop open
            standards for measuring how good a camera&apos;s photos really look to people.
          </p>
          <p className="about-body">
            Phone and camera quality has long been described with numbers like megapixels, but
            those numbers don&apos;t always match what our eyes actually notice. Since publishing
            its first standard in 2016 (with updated versions in 2023 and another in development),
            the group has worked to measure image quality the way real viewers perceive it, so that
            cameras from different makers can be compared fairly. Your choices in this study help
            connect those measurements to genuine human perception.
          </p>
          <a
            className="preview-link"
            href="https://sagroups.ieee.org/1858/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more about IEEE 1858 →
          </a>
        </section>
      </section>
    </main>
  )
}

export default HomePage
