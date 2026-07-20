/**
 * דף "מה חדש" - היסטוריית עדכונים וחידושים
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'fix' | 'improvement' | 'design';
    description: string;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.9.2',
    date: 'יולי 2026',
    changes: [
      {
        type: 'fix',
        description:
          'לחיצה על "פתח פתק" בהתראת תזכורת פותחת עכשיו את הפתק עצמו. קודם היא פתחה את הקטגוריה בלבד, כי מזהה הפתק לא נכלל בכתובת',
      },
      {
        type: 'improvement',
        description:
          'פתק רשימת משימות נפתח עם משימה ראשונה מוכנה, בלי הלחיצה המיותרת על "הוסף משימה"',
      },
    ],
  },
  {
    version: '1.9.1',
    date: 'יולי 2026',
    changes: [
      {
        type: 'fix',
        description:
          'הסרת תאריך יעד ממשימה לא עבדה - התאריך היה נשאר במקומו ורק השעה נמחקה',
      },
      {
        type: 'improvement',
        description:
          'משימה שהשעה שנקבעה לה כבר חלפה מסומנת באדום כמשימה באיחור, ולא בצהוב כמשימה קרובה',
      },
    ],
  },
  {
    version: '1.9.0',
    date: 'יולי 2026',
    changes: [
      {
        type: 'feature',
        description:
          'תזכורות עברו לרמת המשימה. כל משימה שקבעת לה תאריך ושעה תשלח לך התראה במועד - בדיוק כמו שהיה סביר לצפות עד היום',
      },
      {
        type: 'improvement',
        description:
          'התזכורת ברמת הפתק הוסרה. תזכורת אחת לרשימה שלמה לא אמרה כלום על מה בדיוק צריך לעשות',
      },
      {
        type: 'improvement',
        description: 'מועדי המשימות מחושבים לפי שעון ישראל, כולל מעברי שעון קיץ',
      },
    ],
  },
  {
    version: '1.8.1',
    date: 'יולי 2026',
    changes: [
      {
        type: 'fix',
        description:
          'כפתורי הקיצור לקביעת תזכורת ("בעוד שעה", "בעוד 3 שעות", "מחר ב-9:00") הפעילו תזכורת בלי לבקש הרשאת התראות ובלי לרשום את המכשיר. התוצאה הייתה תזכורת שנראית פעילה בממשק אך לא מגיעה לשום מקום',
      },
    ],
  },
  {
    version: '1.8.0',
    date: 'יולי 2026',
    changes: [
      {
        type: 'fix',
        description:
          'התזכורות עובדות סוף סוף גם כשהאפליקציה סגורה. עד היום התזמון רץ בדפדפן, והדפדפן היה מכבה אותו אחרי שניות - כך שכמעט כל תזכורת שנקבעה ליותר מדקה קדימה פשוט לא הופיעה',
      },
      {
        type: 'feature',
        description:
          'התזכורות נשלחות עכשיו מהשרת כהתראת push, ומגיעות לכל המכשירים שבהם נכנסת לאפליקציה',
      },
      {
        type: 'improvement',
        description: 'לחיצה על התראת תזכורת פותחת ישירות את הקטגוריה של הפתק',
      },
    ],
  },
  {
    version: '1.7.1',
    date: 'יולי 2026',
    changes: [
      {
        type: 'improvement',
        description:
          'פתק חשבונאות בנייד: עמודת התיאור הוכפלה ברוחבה על חשבון עמודות התאריך, הסכום והמחיקה',
      },
      {
        type: 'improvement',
        description:
          'לחיצה על Enter בפתק חשבונאות מוסיפה תנועה חדשה ומעבירה אליה את הסמן, בלי לסגור את המקלדת',
      },
      {
        type: 'fix',
        description: 'תיקון שורת "יתרה סופית" בטבלת החשבונאות, שיצרה עמודה עודפת וגלשה מחוץ לטבלה',
      },
    ],
  },
  {
    version: '1.7.0',
    date: 'יולי 2026',
    changes: [
      {
        type: 'improvement',
        description:
          'תבנית "סיכום AI" והשילוב עם Gemini הוסרו מהאפליקציה. הרעיון ייבנה מחדש בהמשך',
      },
      {
        type: 'improvement',
        description:
          'פתקים קיימים מסוג "סיכום AI" נפתחים כטקסט חופשי - התוכן שלהם נשמר במלואו',
      },
      {
        type: 'improvement',
        description: 'מסך השיתוף פשוט יותר: טקסט חופשי או תכנית עבודה, בלי עיבוד אוטומטי',
      },
      {
        type: 'improvement',
        description: 'מסך ההגדרות מוקדש כעת לגיבוי הפתקים',
      },
    ],
  },
  {
    version: '1.6.1',
    date: 'יולי 2026',
    changes: [
      {
        type: 'improvement',
        description:
          'תבנית "סיכום AI" הוסרה מרשימת התבניות לפתק חדש. פתקים קיימים מסוג זה ממשיכים לעבוד כרגיל',
      },
      {
        type: 'fix',
        description: 'תיקון הפריסה האוטומטית של חוקי האבטחה, שנכשלה בשתי הגרסאות האחרונות',
      },
    ],
  },
  {
    version: '1.6.0',
    date: 'יולי 2026',
    changes: [
      {
        type: 'feature',
        description:
          'גיבוי הפתקים לקובץ להורדה (תפריט הפרופיל ← גיבוי והגדרות) - קובץ Markdown קריא לעין, או קובץ JSON מלא לשחזור מדויק',
      },
      {
        type: 'feature',
        description: 'הגיבוי כולל את כל הקטגוריות והפתקים, גם אלה שבארכיון',
      },
      {
        type: 'improvement',
        description: 'מסך ההגדרות נגיש עכשיו ישירות מתפריט הפרופיל',
      },
    ],
  },
  {
    version: '1.5.0',
    date: 'יולי 2026',
    changes: [
      {
        type: 'fix',
        description: 'תזכורות עובדות! עד כה התזכורת נשמרה אך ההתראה מעולם לא נשלחה בפועל',
      },
      {
        type: 'fix',
        description: 'תיקון אבטחה: משתמש ששותפו איתו פתק כבר לא יכול להשתלט עליו או לשנות את רשימת השיתוף',
      },
      {
        type: 'fix',
        description: 'תיקון אבטחה: פרטי המשתמשים אינם חשופים עוד לכל משתמש מחובר',
      },
      {
        type: 'fix',
        description: 'תיקון כפתור ההתנתקות בתפריט הפרופיל, שלא פעל',
      },
      {
        type: 'improvement',
        description: 'עריכת פתק נשמרת אחרי הפסקה בהקלדה במקום בכל הקשת מקש - מהיר יותר וחוסך פניות לשרת',
      },
      {
        type: 'improvement',
        description: 'טעינת הפתקים משתמשת בחיבור אחד משותף במקום אחד לכל קטגוריה',
      },
      {
        type: 'improvement',
        description: 'שינוי סדר פתקים בגרירה נשמר כפעולה אחת, כך שלא נוצר מצב ביניים שגוי',
      },
      {
        type: 'fix',
        description: 'שיתוף בו-זמני של אותו פתק עם כמה משתמשים כבר לא דורס שיתופים קודמים',
      },
      {
        type: 'fix',
        description: 'תיקון הצגת טקסט מודגש או נטוי כשמופיע קישור באותה שורה',
      },
      {
        type: 'improvement',
        description: 'רשימת "משותף עם" מציגה כתובות אימייל במקום מזהים',
      },
      {
        type: 'fix',
        description: 'פתקים ישנים ללא תגיות או תאריך עדכון כבר לא גורמים לשגיאה בפתיחה',
      },
      {
        type: 'improvement',
        description: 'מספר הגרסה נלקח אוטומטית מהפרויקט ולא מתעדכן ידנית בכל מסך',
      },
    ],
  },
  {
    version: '1.4.3',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'fix',
        description: 'תיקון מיון ויישור פתקים מוצמדים במצב מקופל - כעת מופיעים מימין כראוי',
      },
      {
        type: 'improvement',
        description: 'שיפור תמיכה ב-RTL עם dir="rtl" לגלילה אופקית',
      },
    ],
  },
  {
    version: '1.4.2',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'fix',
        description: 'תיקון רקע textarea במצב עריכה עם ערכת צבעים כהה',
      },
    ],
  },
  {
    version: '1.4.1',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'fix',
        description: 'תיקון רוחב רספונסיבי של כרטיס פתק בתצוגת קטגוריה במובייל',
      },
    ],
  },
  {
    version: '1.4.0',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'feature',
        description: 'תצוגת קטגוריה במסך מלא עם רשימה אנכית של פתקים',
      },
      {
        type: 'improvement',
        description: 'שיפור ניווט בין קטגוריות ופתקים',
      },
    ],
  },
  {
    version: '1.3.2',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'fix',
        description: 'תיקון טקסט אנגלי של AI והוספת הגבלת אורך כותרת גלובלית',
      },
    ],
  },
  {
    version: '1.3.1',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'improvement',
        description: 'הוספת בדיקת מוכנות Service Worker והנחיות משופרות למשתמש',
      },
    ],
  },
  {
    version: '1.3.0',
    date: 'ינואר 2025',
    changes: [
      {
        type: 'feature',
        description: 'לוגים מקיפים ומשוב משתמש משופר לכשלי שיתוף',
      },
      {
        type: 'improvement',
        description: 'שיפור טיפול בשגיאות במערכת השיתוף',
      },
    ],
  },
  {
    version: '1.2.9',
    date: 'דצמבר 2024',
    changes: [
      {
        type: 'fix',
        description: 'תיקון Service Worker כדי ליירט כראוי בקשות POST של שיתוף',
      },
    ],
  },
  {
    version: '1.2.8',
    date: 'דצמבר 2024',
    changes: [
      {
        type: 'fix',
        description: 'תיקון שגיאת "URI too long" בעת שיתוף תוכן ארוך',
      },
    ],
  },
  {
    version: '1.2.6',
    date: 'דצמבר 2024',
    changes: [
      {
        type: 'feature',
        description: 'הוספת מתג צפייה/עריכה לתבניות תוכנית עבודה ורשימת משימות',
      },
    ],
  },
  {
    version: '1.2.0',
    date: 'דצמבר 2024',
    changes: [
      {
        type: 'feature',
        description: 'תכונת שיתוף חכם עם אינטגרציה של AI',
      },
      {
        type: 'feature',
        description: 'הוספת פתק - צירוף תוכן לפתק קיים',
      },
      {
        type: 'feature',
        description: 'סיכום חכם של טקסטים ארוכים עם Gemini AI',
      },
    ],
  },
];

const getTypeIcon = (type: ChangelogEntry['changes'][0]['type']) => {
  switch (type) {
    case 'feature':
      return '✨';
    case 'fix':
      return '🐛';
    case 'improvement':
      return '⚡';
    case 'design':
      return '🎨';
    default:
      return '📝';
  }
};

const getTypeName = (type: ChangelogEntry['changes'][0]['type']) => {
  switch (type) {
    case 'feature':
      return 'תכונה חדשה';
    case 'fix':
      return 'תיקון';
    case 'improvement':
      return 'שיפור';
    case 'design':
      return 'עיצוב';
    default:
      return 'שינוי';
  }
};

export const WhatsNew: React.FC = () => {
  const navigate = useNavigate();

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
            <h1 className="text-3xl font-bold text-white">מה חדש</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 pb-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-8">
          {/* Intro */}
          <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="text-5xl mb-4">📰</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              עדכונים וחידושים
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              היסטוריית גרסאות ושינויים באפליקציה
            </p>
          </div>

          {/* Changelog Timeline */}
          <div className="space-y-8">
            {changelog.map((entry, index) => (
              <div
                key={entry.version}
                className={`relative ${
                  index !== changelog.length - 1
                    ? 'pb-8 border-r-2 border-gray-200 dark:border-gray-700 mr-4'
                    : ''
                }`}
              >
                {/* Version Badge */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="absolute right-0 -mr-2.5 w-5 h-5 rounded-full bg-blue-500 border-4 border-white dark:border-gray-800"></div>
                  <div className="mr-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                      גרסה {entry.version}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{entry.date}</p>
                  </div>
                </div>

                {/* Changes List */}
                <div className="mr-6 space-y-3">
                  {entry.changes.map((change, changeIndex) => (
                    <div
                      key={changeIndex}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <span className="text-2xl flex-shrink-0">{getTypeIcon(change.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                            {getTypeName(change.type)}
                          </span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                          {change.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Future Updates */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <span>🚀</span>
              <span>בקרוב...</span>
            </h3>
            <div className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <p>• תכונות נוספות יתווספו בעתיד על בסיס משוב משתמשים</p>
              <p>• עקוב אחר העדכונים ב-
                <a
                  href="https://github.com/Amikashkash/note-web-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline mx-1"
                >
                  GitHub
                </a>
              </p>
            </div>
          </div>

          {/* Feedback */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
              <span>💬</span>
              <span>יש לך רעיון לתכונה חדשה?</span>
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
              אנחנו תמיד שמחים לשמוע מהמשתמשים שלנו! שלח לנו את הרעיונות שלך:
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="mailto:acfish.il@gmail.com?subject=רעיון לתכונה חדשה באפליקציית פתקים"
                className="flex-1"
              >
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <span>📧</span>
                  <span>שלח אימייל</span>
                </Button>
              </a>
              <a
                href="https://github.com/Amikashkash/note-web-app/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <span>💻</span>
                  <span>פתח Issue ב-GitHub</span>
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
