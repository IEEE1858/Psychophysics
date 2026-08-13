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
import ShareStudy from '../components/ShareStudy'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useI18n, useT, useTx } from '../lib/i18n'
import './pages.css'

const EXAMPLE_COUNT = 6

function ExampleGallery({ title, blurb, images, collectionId, previewTo, previewLabel }) {
  const t = useT()

  return (
    <div className="example-group">
      <div className="example-group-head">
        <h3>{title}</h3>
        <p>{blurb}</p>
      </div>

      <div className="example-grid">
        {images.map((image) => (
          // Each example links to that image's detail viewer (issue #30).
          <Link
            key={image.id}
            className="example-tile"
            to={`/preview/${collectionId}/${image.id}`}
            aria-label={t('home.examples.view', { label: image.label })}
          >
            <img src={thumbnailFor(image)} alt={image.label} loading="lazy" />
          </Link>
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
  const { t } = useI18n()
  const tx = useTx()

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
        <div className="site-topbar">
          <LanguageSwitcher />
        </div>

        <header className="home-hero">
          <div className="home-hero-text">
            <p className="eyebrow">{t('home.eyebrow')}</p>
            <h1>{t('home.title')}</h1>
            <p className="home-lead">
              {tx('home.lead1', {
                sharpening: <strong>{t('home.lead1.sharpening')}</strong>,
                hdr: <strong>{t('home.lead1.hdr')}</strong>,
                favorite: <strong>{t('home.lead1.favorite')}</strong>,
                mostRealistic: <strong>{t('home.lead1.mostRealistic')}</strong>,
              })}
            </p>
            <p className="home-lead">{t('home.lead2')}</p>

            {/* Desktop only: on a phone the gate alert beside this already says the
                same thing, at more length. */}
            {isMobile ? null : <p className="hero-viewing-note">{t('home.viewingNote')}</p>}
          </div>

          <div className="home-hero-aside">
            <img
              className="home-hero-feature"
              src="/imageRankFeature.jpg"
              width="960"
              height="426"
              alt="A sunflower and a graffiti underpass, each shown at three increasing levels of HDR processing."
            />

            <div className="home-hero-cta">
              {isMobile ? (
                <Alert severity="info" className="mobile-gate">
                  <strong>{t('home.mobile.title')}</strong>
                  <span>
                    {tx('home.mobile.body', { url: <code>imagerank.imatest.com</code> })}
                  </span>
                </Alert>
              ) : (
                <div className="cta-block">
                  <Button
                    variant="contained"
                    size="large"
                    className="cta-button"
                    onClick={() => navigate(hasSession() ? '/study' : '/demographics')}
                  >
                    {hasSession() ? t('home.cta.resume') : t('home.cta.start')}
                  </Button>

                  {authed ? (
                    <p className="cta-note">
                      {tx('home.cta.signedInAs', {
                        email: <strong>{account.email}</strong>,
                        signOut: (
                          <button type="button" className="link-button" onClick={signOut}>
                            {t('home.cta.signOut')}
                          </button>
                        ),
                      })}
                    </p>
                  ) : (
                    <p className="cta-note">
                      {tx('home.cta.haveAccount', {
                        signIn: (
                          <Link className="preview-link" to="/signin">
                            {t('home.cta.signIn')}
                          </Link>
                        ),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="examples">
          <h2 className="section-title">{t('home.examples.title')}</h2>
          <p className="section-subtitle">{t('home.examples.subtitle')}</p>

          {loading ? (
            <div className="home-status">
              <CircularProgress size={28} />
              <span>{t('home.examples.loading')}</span>
            </div>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !error ? (
            <div className="examples-columns">
              <ExampleGallery
                title={t('home.examples.hdr.title')}
                blurb={t('home.examples.hdr.blurb')}
                images={hdrExamples}
                collectionId="hdr"
                previewTo="/preview/hdr"
                previewLabel={t('home.examples.hdr.preview')}
              />
              <ExampleGallery
                title={t('home.examples.sharpness.title')}
                blurb={t('home.examples.sharpness.blurb')}
                images={sharpnessExamples}
                collectionId="sharpness"
                previewTo="/preview/sharpness"
                previewLabel={t('home.examples.sharpness.preview')}
              />
            </div>
          ) : null}
        </section>

        <section className="about-study">
          <h2 className="section-title">{t('home.about.title')}</h2>
          <p className="about-body">
            {tx('home.about.body1', {
              link: (
                <a
                  className="about-link"
                  href="https://sagroups.ieee.org/1858/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('home.about.linkText')}
                </a>
              ),
            })}
          </p>
          <p className="about-body">{t('home.about.body2')}</p>
          <a
            className="preview-link"
            href="https://sagroups.ieee.org/1858/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('home.about.learnMore')}
          </a>
        </section>

        <ShareStudy
          title={t('share.title')}
          blurb={isMobile ? t('share.blurb.mobile') : t('share.blurb.home')}
        />

        <footer className="site-footer">
          <h2 className="section-title">{t('home.footer.title')}</h2>
          <p className="about-body">
            {tx('home.footer.body', {
              dataset: (
                <a
                  className="about-link"
                  href="https://data.csail.mit.edu/graphics/fivek/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('home.footer.dataset')}
                </a>
              ),
              adobe: (
                <a href="/licenses/LicenseAdobe.txt" target="_blank" rel="noopener noreferrer">
                  {t('home.footer.adobe')}
                </a>
              ),
              adobeMit: (
                <a href="/licenses/LicenseAdobeMIT.txt" target="_blank" rel="noopener noreferrer">
                  {t('home.footer.adobeMit')}
                </a>
              ),
              icon: <span aria-hidden="true">ⓘ</span>,
            })}
          </p>
          <p className="about-body">
            <Link className="preview-link" to="/privacy">
              {t('privacy.link')}
            </Link>
          </p>
          <pre className="citation-bibtex">{`@inproceedings{fivek,
  author = "Vladimir Bychkovsky and Sylvain Paris and Eric Chan and Fr\\'edo Durand",
  title = "Learning Photographic Global Tonal Adjustment with a Database of Input / Output Image Pairs",
  booktitle = "The Twenty-Fourth IEEE Conference on Computer Vision and Pattern Recognition",
  year = "2011"
}`}</pre>
        </footer>
      </section>
    </main>
  )
}

export default HomePage
