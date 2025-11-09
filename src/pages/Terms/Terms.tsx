/**
 * דף תנאי שימוש
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';

export const Terms: React.FC = () => {
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
            <h1 className="text-3xl font-bold text-white">תנאי שימוש</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 pb-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-8">
          <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              עודכן לאחרונה: {lastUpdated}
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                1. קבלת התנאים
              </h2>
              <p className="leading-relaxed">
                על ידי גישה לאפליקציית פתקים ושימוש בה, אתה מסכים לתנאי שימוש אלה. אם אינך מסכים
                לתנאים אלה, אנא אל תשתמש באפליקציה.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                2. תיאור השירות
              </h2>
              <p className="leading-relaxed">
                אפליקציית פתקים היא שירות מקוון ליצירה, אחסון וניהול של פתקים דיגיטליים.
                השירות כולל:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>יצירה ועריכה של פתקים</li>
                <li>ארגון פתקים בקטגוריות</li>
                <li>סנכרון בין מכשירים</li>
                <li>תבניות מוכנות מראש</li>
                <li>אינטגרציה עם Gemini AI לסיכום טקסטים</li>
                <li>שיתוף תוכן מאפליקציות אחרות</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                3. חשבון משתמש
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                3.1 רישום
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>עליך ליצור חשבון על מנת להשתמש באפליקציה</li>
                <li>עליך לספק מידע מדויק ועדכני</li>
                <li>אתה אחראי לשמור על סודיות סיסמת החשבון שלך</li>
                <li>אתה אחראי לכל הפעילות שמתבצעת תחת החשבון שלך</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                3.2 גיל מינימלי
              </h3>
              <p className="leading-relaxed">
                עליך להיות בן 13 לפחות כדי להשתמש באפליקציה זו. אם אתה מתחת לגיל 18, עליך
                לקבל הסכמה מהורה או אפוטרופוס.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                4. שימוש מותר ואסור
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                4.1 שימוש מותר
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>שימוש אישי או עסקי חוקי</li>
                <li>יצירה ואחסון של תוכן שאתה הבעלים או בעל הרשות לשימוש בו</li>
                <li>שיתוף תוכן עם אחרים בהסכמתך</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                4.2 שימוש אסור
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>העלאת תוכן פוגעני, מעליב, או בלתי חוקי</li>
                <li>הפרת זכויות יוצרים או זכויות אחרות של צדדים שלישיים</li>
                <li>ניסיון לפרוץ או לפגוע באבטחת האפליקציה</li>
                <li>שימוש באפליקציה למטרות ספאם או התעללות</li>
                <li>העתקה או הנדסה לאחור של האפליקציה (למעט המותר ברישיון MIT)</li>
                <li>שימוש אוטומטי בכלים שאינם מאושרים על ידינו</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                5. תוכן משתמש
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                5.1 בעלות
              </h3>
              <p className="leading-relaxed">
                אתה שומר על כל הזכויות לתוכן שאתה יוצר באפליקציה. אנו לא תובעים בעלות על
                הפתקים, הקטגוריות, או כל תוכן אחר שאתה מעלה.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                5.2 רישיון שימוש
              </h3>
              <p className="leading-relaxed">
                על מנת לספק את השירות, אתה מעניק לנו רישיון מוגבל לאחסן ולהציג את התוכן שלך
                במסגרת האפליקציה.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                5.3 גיבוי
              </h3>
              <p className="leading-relaxed">
                למרות שאנו מבצעים גיבויים קבועים, אנו ממליצים לך לשמור עותקי גיבוי של תוכן
                חשוב.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                6. קוד פתוח
              </h2>
              <p className="leading-relaxed">
                קוד המקור של האפליקציה זמין תחת רישיון MIT. זה אומר שאתה רשאי:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>להשתמש בקוד למטרות אישיות או מסחריות</li>
                <li>לשנות, להעתיק ולהפיץ את הקוד</li>
                <li>לשלב את הקוד בפרויקטים שלך</li>
              </ul>
              <p className="leading-relaxed mt-4">
                תנאי הרישיון המלאים זמינים ב-
                <a
                  href="https://github.com/Amikashkash/note-web-app/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline mx-1"
                >
                  GitHub
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                7. הגבלת אחריות
              </h2>
              <p className="leading-relaxed">
                <strong>האפליקציה מסופקת "כמות שהיא" ללא אחריות מכל סוג.</strong> אנו לא
                מתחייבים:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>לזמינות רציפה ללא הפרעות</li>
                <li>לתיקון מידי של באגים או בעיות</li>
                <li>לשמירה קבועה על כל התכונות</li>
              </ul>
              <p className="leading-relaxed mt-4">
                במידת האפשר על פי חוק, לא נהיה אחראים לכל נזק ישיר, עקיף, מקרי או תוצאתי
                הנובע משימוש או אי-שימוש באפליקציה.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                8. שינויים ושיפורים
              </h2>
              <p className="leading-relaxed">
                אנו שומרים לעצמנו את הזכות:
              </p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>לשנות או להפסיק תכונות באפליקציה</li>
                <li>לעדכן תנאי שימוש אלה</li>
                <li>לסגור חשבונות שמפרים תנאים אלה</li>
              </ul>
              <p className="leading-relaxed mt-4">
                נודיע לך על שינויים מהותיים דרך האפליקציה או בדוא"ל.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                9. סיום השימוש
              </h2>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                9.1 על ידך
              </h3>
              <p className="leading-relaxed">
                אתה יכול להפסיק להשתמש באפליקציה בכל עת ולמחוק את חשבונך דרך ההגדרות או על ידי
                פנייה אלינו.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 mt-4">
                9.2 על ידינו
              </h3>
              <p className="leading-relaxed">
                אנו רשאים להשעות או לסגור את חשבונך במקרה של הפרת תנאים אלה, לאחר מתן הודעה
                סבירה (אלא אם ההפרה חמורה).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                10. דין וסמכות שיפוט
              </h2>
              <p className="leading-relaxed">
                תנאים אלה כפופים לדיני מדינת ישראל. כל סכסוך יידון בבתי המשפט המוסמכים בישראל.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                11. יצירת קשר
              </h2>
              <p className="leading-relaxed">
                לשאלות או הבהרות בנוגע לתנאי שימוש אלה:
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
                  <strong>GitHub:</strong>{' '}
                  <a
                    href="https://github.com/Amikashkash/note-web-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    github.com/Amikashkash/note-web-app
                  </a>
                </li>
              </ul>
            </section>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              על ידי המשך שימוש באפליקציה, אתה מאשר שקראת והבנת תנאים אלה.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
