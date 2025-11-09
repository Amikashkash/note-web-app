/**
 * דף מדיניות פרטיות
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';

export const Privacy: React.FC = () => {
  const navigate = useNavigate();
  const lastUpdated = 'ינואר 2025';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-gradient-primary dark:bg-gradient-primary-dark shadow-card mb-8">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              ← חזרה
            </Button>
            <h1 className="text-3xl font-bold text-white">מדיניות פרטיות</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 pb-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-8">
          <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="text-5xl mb-4">🔒</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              עודכן לאחרונה: {lastUpdated}
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                1. מבוא
              </h2>
              <p className="leading-relaxed">
                ברוכים הבאים לאפליקציית פתקים. אנו מכבדים את פרטיותך ומחויבים להגן על המידע
                האישי שלך. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים, ומגנים על המידע
                שלך כאשר אתה משתמש באפליקציה שלנו.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                2. מידע שאנו אוספים
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                2.1 מידע שאתה מספק
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>
                  <strong>פרטי חשבון:</strong> כתובת דוא"ל, שם משתמש (אופציונלי), תמונת פרופיל
                  (אופציונלי)
                </li>
                <li>
                  <strong>תוכן:</strong> הפתקים שלך, הקטגוריות שלך, וכל תוכן אחר שאתה יוצר
                  באפליקציה
                </li>
                <li>
                  <strong>העדפות:</strong> הגדרות אפליקציה כמו מצב כהה/בהיר
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                2.2 מידע שנאסף אוטומטית
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>
                  <strong>מידע טכני:</strong> סוג דפדפן, מערכת הפעלה, כתובת IP
                </li>
                <li>
                  <strong>נתוני שימוש:</strong> אינטראקציות עם האפליקציה, זמני שימוש
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                3. כיצד אנו משתמשים במידע שלך
              </h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>
                  <strong>אספקת שירות:</strong> לאפשר לך ליצור, לערוך ולשמור פתקים
                </li>
                <li>
                  <strong>סנכרון:</strong> לסנכרן את הפתקים שלך בין מכשירים שונים
                </li>
                <li>
                  <strong>שיפור:</strong> לשפר את האפליקציה ולהוסיף תכונות חדשות
                </li>
                <li>
                  <strong>תמיכה:</strong> לספק תמיכה טכנית ולפתור בעיות
                </li>
                <li>
                  <strong>אבטחה:</strong> להגן על האפליקציה ועל המשתמשים מפני שימוש לרעה
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                4. אחסון מידע
              </h2>
              <p className="leading-relaxed">
                המידע שלך מאוחסן בשירותי <strong>Google Firebase</strong>, פלטפורמת ענן מאובטחת
                של Google. Firebase עומדת בתקני אבטחה בינלאומיים לרבות:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>
                  <strong>הצפנה:</strong> כל המידע מוצפן בזמן העברה (SSL/TLS) ובמנוחה
                </li>
                <li>
                  <strong>מיקום:</strong> השרתים נמצאים במרכזי נתונים מאובטחים של Google
                </li>
                <li>
                  <strong>גיבוי:</strong> המידע מגובה באופן קבוע
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                5. שיתוף מידע עם צדדים שלישיים
              </h2>
              <p className="leading-relaxed">
                <strong className="text-lg">אנחנו לא מוכרים או משתפים את המידע האישי שלך עם צדדים
                שלישיים למטרות מסחריות.</strong>
              </p>
              <p className="leading-relaxed mt-4">
                אנו משתפים מידע רק במקרים הבאים:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>
                  <strong>ספקי שירות:</strong> Google Firebase (אחסון), Google Gemini AI (סיכום
                  טקסטים)
                </li>
                <li>
                  <strong>דרישות חוק:</strong> כאשר נדרש על פי חוק או בקשה משפטית
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                6. הזכויות שלך
              </h2>
              <p className="leading-relaxed">
                בהתאם לחוק הגנת הפרטיות בישראל ולתקנות ה-GDPR, יש לך את הזכויות הבאות:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>
                  <strong>גישה:</strong> לבקש עותק של כל המידע שיש לנו עליך
                </li>
                <li>
                  <strong>תיקון:</strong> לתקן מידע שגוי או לא מדויק
                </li>
                <li>
                  <strong>מחיקה:</strong> לבקש מחיקת החשבון והמידע שלך
                </li>
                <li>
                  <strong>ייצוא:</strong> לקבל את כל המידע שלך בפורמט נגיש
                </li>
                <li>
                  <strong>התנגדות:</strong> להתנגד לעיבוד מסוים של המידע שלך
                </li>
              </ul>
              <p className="leading-relaxed mt-4">
                כדי לממש את הזכויות שלך, צור קשר ב-{' '}
                <a
                  href="mailto:acfish.il@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  acfish.il@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                7. אבטחת מידע
              </h2>
              <p className="leading-relaxed">
                אנו נוקטים באמצעי אבטחה סבירים להגן על המידע שלך:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>הצפנת נתונים (SSL/TLS)</li>
                <li>אימות מאובטח (Firebase Authentication)</li>
                <li>הגבלת גישה למידע רק למשתמש המחובר</li>
                <li>עדכוני אבטחה קבועים</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                8. קטינים
              </h2>
              <p className="leading-relaxed">
                האפליקציה אינה מיועדת לשימוש ילדים מתחת לגיל 13. אנו לא אוספים במכוון מידע
                מקטינים. אם אתה הורה או אפוטרופוס וחושב שילדך סיפק לנו מידע, אנא צור קשר.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                9. שימוש ב-Cookies ו-Local Storage
              </h2>
              <p className="leading-relaxed">
                האפליקציה משתמשת ב-Local Storage כדי לשמור העדפות שלך (כמו מצב כהה/בהיר) ופרטי
                התחברות. מידע זה נשמר רק במכשיר שלך ואינו מועבר לשרתים שלנו.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                10. שינויים במדיניות
              </h2>
              <p className="leading-relaxed">
                אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. נודיע לך על שינויים מהותיים דרך
                האפליקציה או בדוא"ל. המשך השימוש באפליקציה לאחר שינויים מהווה הסכמה למדיניות
                המעודכנת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                11. יצירת קשר
              </h2>
              <p className="leading-relaxed">
                אם יש לך שאלות או דאגות לגבי מדיניות הפרטיות שלנו, אנא צור קשר:
              </p>
              <ul className="list-none space-y-2 mr-4 mt-2">
                <li>
                  <strong>דוא"ל:</strong>{' '}
                  <a
                    href="mailto:acfish.il@gmail.com"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    acfish.il@gmail.com
                  </a>
                </li>
                <li>
                  <strong>מדינה:</strong> ישראל
                </li>
              </ul>
            </section>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              מדיניות פרטיות זו הינה בעברית. במקרה של סתירה בין גרסה זו לבין גרסאות באותם
              שפות אחרות, גרסה זו תגבר.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
