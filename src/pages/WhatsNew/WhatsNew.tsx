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
