import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useT } from '../lib/i18n'
import './pages.css'

// Privacy policy. The study collects demographics, an optional email, and — for
// guests, who have no account — the request address, so it needs to say plainly what
// happens to those. The commitment not to disclose them is the point of the page.
//
// The body is deliberately English-only for now: a mistranslated privacy commitment
// is worse than an untranslated one, because a participant may rely on it. The title
// and the footer link are translated so a reader can at least find it, and the note
// at the top says which language governs.
function PrivacyPage() {
  const t = useT()

  return (
    <main className="page-shell">
      <section className="page-panel">
        <div className="site-topbar">
          <LanguageSwitcher />
        </div>

        <header className="preview-header">
          <Link className="back-link" to="/">
            {t('demo.back')}
          </Link>
          <p className="eyebrow">{t('privacy.eyebrow')}</p>
          <h1>{t('privacy.title')}</h1>
        </header>

        <section className="about-study privacy-body">
          <p className="about-body privacy-note">{t('privacy.englishOnly')}</p>

          <h2 className="section-title">What we collect</h2>
          <p className="about-body">
            When you take part we record the choices you make about each image (which
            version you found most realistic, which was your favourite, how far you moved
            the slider, how long you spent, and how far you zoomed in), together with the
            answers you give on the &ldquo;About you&rdquo; form: age, gender, how you
            describe yourself, whether your vision is degraded, colour blindness, country
            of origin, and your display and lighting conditions. We also record your
            browser&apos;s user-agent string.
          </p>
          <p className="about-body">
            An <strong>email address is optional</strong>. If you give one, it is stored
            with your responses and used only as described below. If you leave it blank you
            take part as a guest, with no account and no password, and we identify your
            session by the <strong>IP address</strong> your browser connects from so that
            we can tell separate submissions apart. Beyond the analytics described below,
            nothing else about you is collected.
          </p>

          <h2 className="section-title">What we will never do</h2>
          <p className="about-body">
            <strong>
              We will not disclose, sell, publish, or share your private information with
              anyone outside the research team. That includes your email address and your
              IP address.
            </strong>{' '}
            They are never shown in published results, never passed to advertisers or data
            brokers, and never used to contact you for anything you did not ask for.
          </p>
          <p className="about-body">
            Results from this study are published and discussed only in aggregate — as
            distributions and averages across participants. Nothing we publish identifies
            you, and we do not publish per-participant rows containing your email or IP
            address.
          </p>

          <h2 className="section-title">How we use what we collect</h2>
          <p className="about-body">
            The image choices and demographics are used to analyse how sharpening and HDR
            processing change what people perceive, which is the purpose of the study. The
            demographic answers let us check whether perception varies between groups; they
            are analysed in aggregate, not read as individual profiles.
          </p>
          <p className="about-body">
            Your email address is used for two things, and only if you ask: continuing the
            study on another device (if you chose to set a password), and sending you the
            things you explicitly opted into on the final screen — the results of this
            study, and news of future studies. Each of those opt-ins is separate, and you
            can decline both and still take part. Your IP address is used only to tell
            guest submissions apart; we do not use it to locate you or to build a profile.
          </p>

          <h2 className="section-title">Cookies and analytics</h2>
          <p className="about-body">
            We use <strong>Google Analytics</strong> to understand how visitors reach and move
            through the study. It sets cookies (<code>_ga</code> and{' '}
            <code>_ga_49P1MRCD0E</code>) and shares usage data such as pages viewed, approximate
            location, and browser and device details with Google. We use{' '}
            <strong>no advertising trackers</strong>, we do not use analytics data to identify
            you, and we do not link it to the choices you make in the study.
          </p>
          <p className="about-body">
            The study also stores a small amount of data in your browser&apos;s local storage —
            your participant id, your answers, your place in the study, and your chosen language
            — so that you can close the tab and resume later. Clearing your browser&apos;s
            cookies and site storage clears both.
          </p>

          <h2 className="section-title">Where the data lives, and for how long</h2>
          <p className="about-body">
            Responses are stored on a server operated by Imatest on behalf of the IEEE 1858
            Camera Perceptual Image Quality working group. Access is limited to the research
            team. Study images are served from Amazon S3, and analytics data is processed by
            Google. We keep responses for as long as the research is ongoing; we do not need
            your email or IP address after analysis is complete, and we remove them when they
            are no longer required.
          </p>

          <h2 className="section-title">Your choices</h2>
          <p className="about-body">
            You can stop at any time, and you can take part without giving an email address
            at all. You can withdraw either contact opt-in on the final screen, which
            clears the stored address once you have withdrawn both. If you would like your
            responses removed, or want to know what we hold about you, contact us and we
            will do it.
          </p>
          <p className="about-body">
            You can refuse analytics by blocking cookies for this site in your browser, or by
            using a browser extension that blocks Google Analytics. The study itself works
            normally either way.
          </p>

          <h2 className="section-title">Contact</h2>
          <p className="about-body">
            Questions about this policy or about your data can be sent to{' '}
            <a className="about-link" href="mailto:support@imatest.com">
              support@imatest.com
            </a>
            .
          </p>
        </section>
      </section>
    </main>
  )
}

export default PrivacyPage
