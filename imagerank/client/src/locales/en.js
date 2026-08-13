// English source strings (issue #50). This file is the source of truth: every other
// locale is a translation of these keys, and any key a locale omits falls back to the
// English here rather than rendering the key.
//
// Conventions:
//   - Keys are grouped by the screen they appear on.
//   - {name} placeholders are filled at render time. Never concatenate strings in
//     components; add a placeholder instead, so translators control word order.
//
// Scope note: this covers the home page and the sharing UI. The study screen,
// demographics form, and rankings review are still English in the components; they
// will land here as they are converted, and until then they simply render English.
export default {
  // ---- Language switcher ----
  'lang.label': 'Language',
  'lang.choose': 'Choose a language',

  // ---- Home: hero ----
  'home.eyebrow': 'IEEE 1858 · Psychophysics Study',
  // Translators: "image" here means a *photograph*, not a likeness or reputation,
  // and "rank" means ordering/rating them, not a military rank.
  'home.title': 'Image Rank',
  'home.lead1':
    'This study explores how {sharpening} and {hdr} image processing change the way a photo is perceived. You will review the same image rendered at several different levels of processing and choose the version that is your {favorite} and the version that looks the {mostRealistic}.',
  'home.lead1.sharpening': 'sharpening',
  'home.lead1.hdr': 'HDR',
  'home.lead1.favorite': 'favorite',
  'home.lead1.mostRealistic': 'most realistic',
  'home.lead2':
    'These two choices need not be the same. The most realistic image is not always the one that looks the most polished, and that tension is exactly what we are measuring.',
  'home.viewingNote':
    'For consistent results, please take the study on a desktop or laptop computer in indoor lighting conditions.',

  // ---- Home: call to action ----
  'home.cta.start': 'Start the Study',
  'home.cta.resume': 'Resume the Study',
  'home.cta.signedInAs': 'Signed in as {email}. {signOut}',
  'home.cta.signOut': 'Sign out',
  'home.cta.haveAccount': 'Have an account, or want to continue on another device? {signIn}',
  'home.cta.signIn': 'Sign in',

  // ---- Home: mobile gate ----
  'home.mobile.title': 'Please switch to a desktop or laptop computer.',
  'home.mobile.body':
    'Accurate viewing requires a larger screen in indoor lighting conditions. Open this page ({url}) on your desktop or laptop to take part in the study.',

  // ---- Home: examples ----
  'home.examples.title': 'Example Images',
  'home.examples.subtitle':
    'A sample of the images you will rank. Browse the full set before you begin.',
  'home.examples.loading': 'Loading example images…',
  'home.examples.hdr.title': 'HDR',
  'home.examples.hdr.blurb': 'High-dynamic-range tone mapping across processing levels.',
  'home.examples.hdr.preview': 'Preview HDR images',
  'home.examples.sharpness.title': 'Sharpness',
  'home.examples.sharpness.blurb': 'Unsharp-mask sharpening across processing levels.',
  'home.examples.sharpness.preview': 'Preview Sharpness images',
  'home.examples.view': 'View {label}',

  // ---- Home: about ----
  'home.about.title': 'Who is conducting this study?',
  'home.about.body1':
    'This study is run by the {link} working group, a group of imaging engineers and researchers who develop open standards for measuring how good a camera’s photos really look to people.',
  'home.about.linkText': 'IEEE 1858 Camera Perceptual Image Quality',
  'home.about.body2':
    'Phone and camera quality has long been described with numbers like megapixels, but those numbers don’t always match what our eyes actually notice. Since publishing its first standard in 2016 (with updated versions in 2023 and another in development), the group has worked to measure image quality the way real viewers perceive it, so that cameras from different makers can be compared fairly. Your choices in this study help connect those measurements to genuine human perception.',
  'home.about.learnMore': 'Learn more about IEEE 1858 →',

  // ---- Home: footer / dataset ----
  'home.footer.title': 'Image dataset & license',
  'home.footer.body':
    'Study images are from the {dataset} (Bychkovsky et al., 2011), used under the {adobe} and {adobeMit} research licenses. Each image’s applicable license is linked in its information ({icon}) panel.',
  'home.footer.dataset': 'MIT-Adobe FiveK Dataset',
  'home.footer.adobe': 'Adobe',
  'home.footer.adobeMit': 'Adobe–MIT',

  // ---- Sharing ----
  'privacy.title': 'Privacy policy',
  'privacy.eyebrow': 'How we handle your data',
  'privacy.link': 'Privacy policy',
  'privacy.englishOnly': 'This policy is available in English only for now. The English text is the version that governs.',
  'share.title': 'Help us find more participants',
  'share.blurb': 'The more people who take part, the better the results. Pass the study on:',
  'share.blurb.home': 'The study needs many pairs of eyes. Invite people who would enjoy it:',
  'share.blurb.mobile':
    'You can take the study on a laptop later. In the meantime, send it to someone who has one:',
  'share.email': 'Email',
  'share.facebook': 'Facebook',
  'share.twitter': 'Twitter',
  'share.bluesky': 'Bluesky',
  'share.mastodon': 'Mastodon',
  'share.copyLink': 'Copy link',
  'share.copied': 'Link copied: {url}',
  'share.copyManually': 'Copy this link: {url}',
  'share.mastodon.dialogTitle': 'Share to Mastodon',
  'share.mastodon.instanceLabel': 'Mastodon instance',
  'share.mastodon.placeholder': 'mastodon.social',
  'share.mastodon.help': 'Enter the server you have an account on. We remember it for next time.',
  'share.mastodon.cancel': 'Cancel',
  'share.mastodon.confirm': 'Continue',

  // ---- Demographics form ----
  'demo.back': '← Back to home',
  'demo.backToStudy': '← Back to the study',
  'demo.eyebrow.before': 'Before you begin',
  'demo.eyebrow.edit': 'Edit your details',
  'demo.title': 'About you',
  'demo.lead':
    'A few questions about you and your viewing setup. This helps us interpret the results. All fields are required.',
  'demo.age': 'Age',
  'demo.gender': 'Gender',
  'demo.email': 'Email',
  'demo.emailPlaceholder': 'you@example.com',
  'demo.emailOptional': 'Email (optional)',
  'demo.error.emailForAccount': 'An email address is needed to create an account. Add one, or clear the password to continue without an account.',
  'demo.selfDescription': 'How would you describe yourself?',
  'demo.visionStatus': 'Is your vision degraded?',
  'demo.visionDetails': 'Vision details',
  'demo.visionDetailsPlaceholder': 'Provide details about your vision.',
  'demo.colorBlind': 'Color blindness?',
  'demo.country': 'Country of origin',
  'demo.displayType': 'What kind of display?',
  'demo.lighting': 'What kind of lighting?',
  'demo.timeBudget': 'How much time do you have to review images?',
  'demo.timeBudgetHelp':
    'We will show you about as many images as fit in this time. You can always stop early or ask for more at the end.',
  'demo.minutesShort': '{value} min',

  // Dropdown labels are translated; the values stored in the database stay English.
  'demo.gender.female': 'Female',
  'demo.gender.male': 'Male',
  'demo.gender.nonBinary': 'Non-binary',
  'demo.gender.preferNotToSay': 'Prefer not to say',
  'demo.self.regular': 'Regular person',
  'demo.self.expert': 'Photographer / Imaging Expert',
  'demo.vision.ordinary': 'No - Ordinary vision',
  'demo.vision.corrected': 'No because of correction with glasses/contact lenses/surgery',
  'demo.vision.yesDetails': 'Yes, provide details',
  'demo.yes': 'Yes',
  'demo.no': 'No',
  'demo.display.laptop': 'Laptop',
  'demo.display.monitor': 'External Monitor',
  'demo.lighting.dim': 'Dim Light',
  'demo.lighting.indoor': 'Normal Indoor Lighting',
  'demo.lighting.outdoor': 'Outdoor Lighting (not recommended)',

  'demo.account.title': 'Save your progress across devices (optional)',
  'demo.account.body':
    'Set a password to create an account tied to the email above, then sign in on another computer to pick up where you left off. Leave this blank to continue without an account. Prefer Google? {googleLink}.',
  'demo.account.google': 'Sign in with Google',
  'demo.password': 'Create a password (optional)',
  'demo.passwordHelp': 'At least {min} characters.',

  'demo.error.required': 'Required',
  'demo.error.email': 'Enter a valid email address',
  'demo.error.visionDetails': 'Please provide details about your vision',
  'demo.error.fix': 'Please correct the highlighted fields before continuing.',

  'demo.error.password': 'Password must be at least {min} characters.',
  'demo.error.account': 'Could not create your account. Please try again.',
  'demo.error.save': 'We could not save your responses. Please check your connection and try again.',
  'demo.cancel': 'Cancel',
  'demo.backHome': 'Back to home',
  'demo.saving': 'Saving…',
  'demo.saveReturn': 'Save and return to study',
  'demo.submit': 'Continue to the study',

  // ---- Study screen ----
  'study.topbar.title': 'IEEE 1858 CPIQ Image Rank',
  'study.topbar.progress': '{collection} image {position} of {total}: {image}',
  'study.topbar.reranking': 'Re-ranking: {collection} — {image}',
  'study.slider.aria': 'Processing level',
  'study.marker.realisticAt': 'Most realistic at level {level}',
  'study.marker.favoriteAt': 'Favorite image at level {level}',
  'study.loadingLibrary': 'Loading image library…',
  'study.exploreMore': 'please move slider to the right to look at other more processed images before deciding.',
  'study.topbar.help': 'Replay the guided tour',
  'study.topbar.rankings': 'Rankings',
  'study.topbar.editDemographics': 'Edit demographics',
  'study.topbar.imageInfo': 'Image information',
  'study.topbar.zoomOut': 'Zoom out',
  'study.topbar.zoomIn': 'Zoom in',
  'study.topbar.resetView': 'Reset view',
  'study.slider.unprocessed': 'Unprocessed',
  'study.slider.heavilyProcessed': 'Heavily processed',
  'study.pickMostRealistic': 'Pick most realistic',
  'study.pickFavorite': 'Pick favorite image',
  'study.previous': 'Previous',
  'study.nextImage': 'Next image',
  'study.saveChanges': 'Save changes',
  'study.finish': 'Finish',
  'study.loading.title': 'Loading image',

  // The post text itself, so a shared link arrives written in the sharer's language.
  'share.subject': 'Which photo do you like best, and which one looks real?',
  'share.text':
    'Which photo do you like best, and which one looks real? They are often not the same image. IEEE Camera Perceptual Image Quality researchers are measuring that gap, and need people to look at photos and choose. No expertise required.',
}
