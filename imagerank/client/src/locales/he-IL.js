// Hebrew (he-IL). Written right-to-left; the app sets dir="rtl" for this locale (see
// lib/i18n.jsx). Keys omitted here fall back to English.
//
// Note on the {url} and {icon} placeholders: they hold left-to-right content
// (a domain, an icon) inside right-to-left sentences. The browser's bidi algorithm
// handles the reordering, which is why they stay placeholders rather than being
// spliced into the sentence as text.
export default {
  'lang.label': 'שפה',
  'lang.choose': 'בחירת שפה',

  'home.eyebrow': 'IEEE 1858 · מחקר פסיכופיזיקה',
  'home.title': 'דירוג תמונות',
  'home.lead1':
    'מחקר זה בודק כיצד {sharpening} ועיבוד תמונה בשיטת {hdr} משנים את האופן שבו נתפסת תמונה. תראו את אותה תמונה בכמה רמות עיבוד שונות, ותבחרו את הגרסה {favorite} ואת הגרסה שנראית {mostRealistic}.',
  'home.lead1.sharpening': 'חידוד',
  'home.lead1.hdr': 'HDR',
  'home.lead1.favorite': 'האהובה עליכם',
  'home.lead1.mostRealistic': 'המציאותית ביותר',
  'home.lead2':
    'שתי הבחירות אינן חייבות להיות זהות. התמונה המציאותית ביותר אינה תמיד זו שנראית המושלמת ביותר, ובדיוק את הפער הזה אנחנו מודדים.',
  'home.viewingNote':
    'לקבלת תוצאות עקביות, אנא בצעו את המחקר במחשב שולחני או נייד, בתנאי תאורה פנימית.',

  'home.cta.start': 'התחלת המחקר',
  'home.cta.resume': 'המשך המחקר',
  'home.cta.signedInAs': 'מחוברים כ־{email}. {signOut}',
  'home.cta.signOut': 'התנתקות',
  'home.cta.haveAccount': 'יש לכם חשבון, או שברצונכם להמשיך במכשיר אחר? {signIn}',
  'home.cta.signIn': 'התחברות',

  'home.mobile.title': 'אנא עברו למחשב שולחני או נייד.',
  'home.mobile.body':
    'צפייה מדויקת מחייבת מסך גדול יותר בתנאי תאורה פנימית. פתחו דף זה ({url}) במחשב השולחני או הנייד שלכם כדי להשתתף במחקר.',

  'home.examples.title': 'תמונות לדוגמה',
  'home.examples.subtitle': 'מדגם מהתמונות שתדרגו. אפשר לעיין באוסף המלא לפני שמתחילים.',
  'home.examples.loading': 'טוען תמונות לדוגמה…',
  'home.examples.hdr.title': 'HDR',
  'home.examples.hdr.blurb': 'מיפוי גוני טווח דינמי רחב בכמה רמות עיבוד.',
  'home.examples.hdr.preview': 'צפייה בתמונות HDR',
  'home.examples.sharpness.title': 'חדות',
  'home.examples.sharpness.blurb': 'חידוד במסכת חידוד בכמה רמות עיבוד.',
  'home.examples.sharpness.preview': 'צפייה בתמונות חדות',
  'home.examples.view': 'צפייה ב{label}',

  'home.about.title': 'מי עורך את המחקר?',
  'home.about.body1':
    'המחקר נערך על ידי קבוצת העבודה {link}, קבוצה של מהנדסי דימות וחוקרים המפתחים תקנים פתוחים למדידת כמה טוב באמת נראות תמונות של מצלמה בעיני אנשים.',
  'home.about.linkText': 'IEEE 1858 Camera Perceptual Image Quality',
  'home.about.body2':
    'איכות הטלפונים והמצלמות תוארה שנים רבות במספרים כמו מגה־פיקסלים, אך מספרים אלה אינם תמיד מתאימים למה שהעין שלנו מבחינה בו בפועל. מאז פרסום התקן הראשון בשנת 2016 (עם גרסאות מעודכנות בשנת 2023 ואחת נוספת בפיתוח), הקבוצה פועלת למדוד איכות תמונה כפי שצופים אמיתיים תופסים אותה, כדי שניתן יהיה להשוות בהגינות בין מצלמות של יצרנים שונים. הבחירות שלכם במחקר זה מסייעות לקשר בין המדידות הללו לתפיסה האנושית האמיתית.',
  'home.about.learnMore': 'מידע נוסף על IEEE 1858 →',

  'home.footer.title': 'מקור התמונות והרישיון',
  'home.footer.body':
    'תמונות המחקר לקוחות מ־{dataset} (Bychkovsky et al., 2011), ונעשה בהן שימוש לפי רישיונות המחקר של {adobe} ושל {adobeMit}. הרישיון החל על כל תמונה מקושר בלוח המידע ({icon}) שלה.',
  'home.footer.dataset': 'MIT-Adobe FiveK Dataset',
  'home.footer.adobe': 'Adobe',
  'home.footer.adobeMit': 'Adobe–MIT',

  'privacy.title': 'מדיניות פרטיות',
  'privacy.eyebrow': 'איך אנחנו מטפלים בנתונים שלכם',
  'privacy.link': 'מדיניות פרטיות',
  'privacy.englishOnly': 'בשלב זה המדיניות זמינה באנגלית בלבד. הנוסח האנגלי הוא הקובע.',
  'share.title': 'עזרו לנו למצוא משתתפים נוספים',
  'share.blurb': 'כמה שיותר אנשים משתתפים, כך התוצאות טובות יותר. העבירו את המחקר הלאה:',
  'share.blurb.home': 'המחקר זקוק להרבה עיניים. הזמינו אנשים שייהנו ממנו:',
  'share.blurb.mobile':
    'תוכלו לבצע את המחקר במחשב נייד מאוחר יותר. בינתיים, שלחו אותו למי שיש לו מחשב:',
  'share.email': 'דוא״ל',
  'share.facebook': 'Facebook',
  'share.twitter': 'Twitter',
  'share.bluesky': 'Bluesky',
  'share.mastodon': 'Mastodon',
  'share.copyLink': 'העתקת קישור',
  'share.copied': 'הקישור הועתק: {url}',
  'share.copyManually': 'העתיקו קישור זה: {url}',
  'share.mastodon.dialogTitle': 'שיתוף ב־Mastodon',
  'share.mastodon.instanceLabel': 'מופע Mastodon',
  'share.mastodon.placeholder': 'mastodon.social',
  'share.mastodon.help': 'הזינו את השרת שבו יש לכם חשבון. נזכור אותו לפעם הבאה.',
  'share.mastodon.cancel': 'ביטול',
  'share.mastodon.confirm': 'המשך',

  'demo.back': '← חזרה לדף הבית',
  'demo.backToStudy': '← חזרה למחקר',
  'demo.eyebrow.before': 'לפני שמתחילים',
  'demo.eyebrow.edit': 'עריכת הפרטים שלכם',
  'demo.title': 'עליכם',
  'demo.lead':
    'כמה שאלות עליכם ועל תנאי הצפייה שלכם. הן עוזרות לנו לפרש את התוצאות. כל השדות נדרשים.',
  'demo.age': 'גיל',
  'demo.gender': 'מגדר',
  'demo.email': 'דוא״ל',
  'demo.emailPlaceholder': 'you@example.com',
  'demo.emailOptional': 'דוא״ל (אופציונלי)',
  'demo.error.emailForAccount': 'כדי ליצור חשבון נדרשת כתובת דוא״ל. הוסיפו אחת, או מחקו את הסיסמה כדי להמשיך בלי חשבון.',
  'demo.selfDescription': 'כיצד תתארו את עצמכם?',
  'demo.visionStatus': 'האם הראייה שלכם ירודה?',
  'demo.visionDetails': 'פרטים על הראייה',
  'demo.visionDetailsPlaceholder': 'פרטו על הראייה שלכם.',
  'demo.colorBlind': 'עיוורון צבעים?',
  'demo.country': 'ארץ מקור',
  'demo.displayType': 'איזה סוג מסך?',
  'demo.lighting': 'איזה סוג תאורה?',
  'demo.timeBudget': 'כמה זמן יש לכם לבחון תמונות?',
  'demo.timeBudgetHelp':
    'נציג בערך כמה תמונות שנכנסות בזמן הזה. תמיד אפשר לעצור מוקדם יותר או לבקש עוד בסוף.',
  'demo.minutesShort': '{value} דק׳',

  'demo.gender.female': 'אישה',
  'demo.gender.male': 'גבר',
  'demo.gender.nonBinary': 'א־בינארי',
  'demo.gender.preferNotToSay': 'מעדיף/ה לא לענות',
  'demo.self.regular': 'אדם רגיל',
  'demo.self.expert': 'צלם / מומחה דימות',
  'demo.vision.ordinary': 'לא — ראייה רגילה',
  'demo.vision.corrected': 'לא, בשל תיקון במשקפיים/עדשות מגע/ניתוח',
  'demo.vision.yesDetails': 'כן, אפרט',
  'demo.yes': 'כן',
  'demo.no': 'לא',
  'demo.display.laptop': 'מחשב נייד',
  'demo.display.monitor': 'מסך חיצוני',
  'demo.lighting.dim': 'אור עמום',
  'demo.lighting.indoor': 'תאורה פנימית רגילה',
  'demo.lighting.outdoor': 'תאורת חוץ (לא מומלץ)',

  'demo.account.title': 'שמירת ההתקדמות בין מכשירים (אופציונלי)',
  'demo.account.body':
    'הגדירו סיסמה כדי ליצור חשבון המקושר לכתובת הדוא״ל שלמעלה, ואז התחברו במחשב אחר כדי להמשיך מאותה נקודה. השאירו ריק כדי להמשיך בלי חשבון. מעדיפים Google? {googleLink}.',
  'demo.account.google': 'התחברות עם Google',
  'demo.password': 'יצירת סיסמה (אופציונלי)',
  'demo.passwordHelp': 'לפחות {min} תווים.',

  'demo.error.required': 'נדרש',
  'demo.error.email': 'הזינו כתובת דוא״ל תקינה',
  'demo.error.visionDetails': 'נא לפרט על הראייה שלכם',
  'demo.error.fix': 'נא לתקן את השדות המסומנים לפני שממשיכים.',

  'demo.error.password': 'הסיסמה חייבת לכלול לפחות {min} תווים.',
  'demo.error.account': 'לא ניתן ליצור את החשבון שלכם. נסו שוב.',
  'demo.error.save': 'לא ניתן לשמור את התשובות שלכם. בדקו את החיבור ונסו שוב.',
  'demo.cancel': 'ביטול',
  'demo.backHome': 'חזרה לדף הבית',
  'demo.saving': 'שומר…',
  'demo.saveReturn': 'שמירה וחזרה למחקר',
  'demo.submit': 'המשך למחקר',

  'study.topbar.title': 'IEEE 1858 CPIQ Image Rank',
  'study.topbar.progress': '{collection}, תמונה {position} מתוך {total}: {image}',
  'study.topbar.reranking': 'דירוג מחדש: {collection} — {image}',
  'study.slider.aria': 'רמת עיבוד',
  'study.marker.realisticAt': 'המציאותית ביותר ברמה {level}',
  'study.marker.favoriteAt': 'התמונה האהובה ברמה {level}',
  'study.loadingLibrary': 'טוען את ספריית התמונות…',
  'study.exploreMore': 'הזיזו את המחוון ימינה כדי לראות תמונות מעובדות יותר לפני שמחליטים.',
  'study.topbar.help': 'הצגת ההדרכה מחדש',
  'study.topbar.rankings': 'דירוגים',
  'study.topbar.editDemographics': 'עריכת פרטים',
  'study.topbar.imageInfo': 'מידע על התמונה',
  'study.topbar.zoomOut': 'התרחקות',
  'study.topbar.zoomIn': 'התקרבות',
  'study.topbar.resetView': 'איפוס התצוגה',
  'study.slider.unprocessed': 'ללא עיבוד',
  'study.slider.heavilyProcessed': 'עיבוד כבד',
  'study.pickMostRealistic': 'בחירת המציאותית ביותר',
  'study.pickFavorite': 'בחירת האהובה',
  'study.previous': 'הקודמת',
  'study.nextImage': 'התמונה הבאה',
  'study.saveChanges': 'שמירת שינויים',
  'study.finish': 'סיום',
  'study.loading.title': 'טוען תמונה',

  'share.subject': 'איזו תמונה אתם מעדיפים, ואיזו נראית אמיתית?',
  'share.text':
    'איזו תמונה אתם מעדיפים, ואיזו נראית אמיתית? לרוב אלה אינן אותה תמונה. חוקרי IEEE Camera Perceptual Image Quality מודדים את הפער הזה, וזקוקים לאנשים שיביטו בתמונות ויבחרו. ללא צורך בידע מקצועי.',
}
