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
  'home.title': 'Image Rank',
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

  'share.subject': 'איזו תמונה אתם מעדיפים, ואיזו נראית אמיתית?',
  'share.text':
    'איזו תמונה אתם מעדיפים, ואיזו נראית אמיתית? לרוב אלה אינן אותה תמונה. קבוצת תקני הדימות IEEE 1858 מודדת את הפער הזה, וזקוקה לאנשים שיביטו בתמונות ויבחרו. 15 עד 45 דקות במחשב נייד, ללא צורך בידע מקצועי.',
  'share.textShort':
    'איזו תמונה אתם מעדיפים, ואיזו נראית אמיתית? לרוב אלה אינן אותה תמונה. קבוצת תקני הדימות IEEE 1858 מודדת את הפער הזה. 15 עד 45 דקות במחשב נייד, ללא ידע מקצועי.',
}
