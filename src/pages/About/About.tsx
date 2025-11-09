/**
 * דף אודות - מידע על האפליקציה והמפתח
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';

export const About: React.FC = () => {
  const navigate = useNavigate();
  const version = '1.4.4'; // יתעדכן אוטומטית מ-package.json

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
            <h1 className="text-3xl font-bold text-white">אודות</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 pb-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-8">
          {/* לוגו וכותרת */}
          <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              אפליקציית פתקים
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">גרסה {version}</p>
          </div>

          {/* תיאור */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span>💡</span>
              <span>אודות האפליקציה</span>
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              אפליקציית פתקים חכמה ומאורגנת עם תמיכה מלאה בעברית RTL, ניהול קטגוריות צבעוניות,
              תבניות מגוונות לפתקים, אינטגרציה עם Gemini AI לסיכום חכם, ושיתוף חכם של תוכן -
              הכל במסגרת חוויית משתמש נעימה ומהירה.
            </p>
          </div>

          {/* תכונות עיקריות */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span>✨</span>
              <span>תכונות עיקריות</span>
            </h3>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🎨</span>
                <span>ניהול קטגוריות צבעוניות ומותאמות אישית</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">📋</span>
                <span>תבניות מגוונות: רגיל, רשימת משימות, מתכון, רשימת קניות, ועוד</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🤖</span>
                <span>אינטגרציה עם Gemini AI לסיכום חכם של טקסטים</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🔗</span>
                <span>שיתוף חכם - קבלת תוכן מאפליקציות אחרות ישירות לפתקים</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">📌</span>
                <span>נעיצת פתקים חשובים לגישה מהירה</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🌙</span>
                <span>מצב כהה לעבודה נוחה בכל שעות היום</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🇮🇱</span>
                <span>תמיכה מלאה בעברית RTL</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">📱</span>
                <span>PWA - עובד כאפליקציה מקומית במובייל ובדסקטופ</span>
              </li>
            </ul>
          </div>

          {/* מפתח */}
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span>👨‍💻</span>
              <span>מפתח</span>
            </h3>
            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p>
                <strong>שם:</strong> Ami (Amos) Kashkash
              </p>
              <p className="flex items-center gap-2">
                <strong>יצירת קשר:</strong>
                <a
                  href="mailto:acfish.il@gmail.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  acfish.il@gmail.com
                </a>
              </p>
              <p className="flex items-center gap-2">
                <strong>דיווח על באגים:</strong>
                <a
                  href="mailto:amidev64@gmail.com?subject=דיווח על באג באפליקציית פתקים"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  amidev64@gmail.com
                </a>
              </p>
            </div>
          </div>

          {/* קוד פתוח */}
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span>💻</span>
              <span>קוד פתוח</span>
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              האפליקציה הזו היא קוד פתוח ומופצת תחת רישיון MIT.
              <br />
              קוד המקור זמין ב-
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

          {/* טכנולוגיות */}
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <span>🛠️</span>
              <span>טכנולוגיות</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                'React',
                'TypeScript',
                'Vite',
                'Firebase',
                'Tailwind CSS',
                'Zustand',
                'React Router',
                'Gemini AI',
                'PWA',
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* קישורים */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <Button
              onClick={() => navigate('/whats-new')}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <span>📰</span>
              <span>מה חדש</span>
            </Button>
            <Button
              onClick={() => navigate('/privacy')}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <span>🔒</span>
              <span>מדיניות פרטיות</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
