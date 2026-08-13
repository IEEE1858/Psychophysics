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

  // The post text itself, so a shared link arrives written in the sharer's language.
  'share.subject': 'Which photo do you like best, and which one looks real?',
  'share.text':
    'Which photo do you like best, and which one looks real? They are often not the same image. The IEEE 1858 imaging standards group is measuring that gap, and needs people to look at photos and choose. 15–45 minutes on a laptop, no expertise required.',
  'share.textShort':
    'Which photo do you like best, and which one looks real? Often not the same image. The IEEE 1858 imaging standards group is measuring that gap. 15–45 minutes on a laptop, no expertise needed.',
}
