/**
 * תפריט פרופיל עם אפשרויות הגדרות ומידע
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SignOutDialog } from '@/components/profile/SignOutDialog/SignOutDialog';
import { useSafeSignOut } from '@/hooks/useSafeSignOut';
import { avatarInitial } from '@/utils/avatar';

export const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const safeSignOut = useSafeSignOut();
  const navigate = useNavigate();
  // תמונה שלא נטענה (קישור שפג, חסימה) - נופלים לאות, כמו משתמש בלי תמונה
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const photo = user?.photoURL && user.photoURL !== brokenPhoto ? user.photoURL : null;
  const initial = avatarInitial(user?.displayName, user?.email);

  // סגירת התפריט בלחיצה מחוץ לתפריט
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMenuClick = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await safeSignOut.start();
  };

  return (
    <div className="relative" ref={menuRef}>
      <SignOutDialog signOut={safeSignOut} />
      {/* כפתור פרופיל */}
      {/* תמיד יש אווטאר: מתחת ל-lg הוא כל הכפתור. קודם רק תמונה הוצגה, ומשתמש
          בלי תמונה (אימייל וסיסמה) קיבל כפתור ריק ובלתי נראה - בלי דרך להגיע
          להגדרות או להתנתק (v1.40.1) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand/40 rounded-lg p-1"
        aria-label="תפריט משתמש"
        aria-expanded={isOpen}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            onError={() => setBrokenPhoto(photo)}
            className="w-10 h-10 rounded-full border border-hairline-light dark:border-hairline-dark object-cover flex-shrink-0"
          />
        ) : (
          <span
            aria-hidden="true"
            className="w-10 h-10 rounded-full grid place-items-center flex-shrink-0 bg-brand-soft dark:bg-brand-soft-dark text-brand-text dark:text-brand-text-dark border border-brand-soft-bd dark:border-brand-soft-bd-dark text-h2"
          >
            {initial ?? <UserRound size={22} strokeWidth={2} />}
          </span>
        )}
        {/* הכותרת בהירה (surface): `text-white` שהיה כאן לא נראה במצב יום */}
        <div className="text-right hidden lg:block">
          <p className="font-medium text-ink-light dark:text-ink-dark text-sm">{user?.displayName}</p>
          <p className="text-body-sm text-ink-2-light dark:text-ink-2-dark">{user?.email}</p>
        </div>
        <svg
          className={`w-4 h-4 text-ink-3-light dark:text-ink-3-dark transition-transform hidden lg:block ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* תפריט dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-hairline-light dark:border-hairline-dark overflow-hidden z-50">
          {/* מידע משתמש */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b border-hairline-light dark:border-hairline-dark lg:hidden">
            <p className="font-medium text-ink-light dark:text-ink-dark dark:text-white text-sm">
              {user?.displayName}
            </p>
            <p className="text-xs text-ink-2-light dark:text-ink-2-dark">{user?.email}</p>
          </div>

          {/* פריטי תפריט */}
          <div className="py-2">
            <button
              onClick={() => handleMenuClick('/settings')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">💾</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">גיבוי והגדרות</span>
            </button>

            <div className="border-t border-hairline-light dark:border-hairline-dark my-2"></div>

            <button
              onClick={() => handleMenuClick('/about')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">ℹ️</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">אודות</span>
            </button>

            <button
              onClick={() => handleMenuClick('/whats-new')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">📰</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">מה חדש</span>
            </button>

            <button
              onClick={() => handleMenuClick('/privacy')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">🔒</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">מדיניות פרטיות</span>
            </button>

            <button
              onClick={() => handleMenuClick('/terms')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">📄</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">תנאי שימוש</span>
            </button>

            <div className="border-t border-hairline-light dark:border-hairline-dark my-2"></div>

            <button
              onClick={() => window.open(`mailto:amidev64@gmail.com?subject=דיווח על באג באפליקציית פתקים`, '_blank')}
              className="w-full text-right px-4 py-3 hover:bg-raised-light dark:bg-raised-dark dark:hover:bg-raised-dark transition-colors flex items-center gap-3"
            >
              <span className="text-xl">🐛</span>
              <span className="text-sm text-ink-light dark:text-ink-dark">דווח על תקלה</span>
            </button>

            <div className="border-t border-hairline-light dark:border-hairline-dark my-2"></div>

            <button
              onClick={handleSignOut}
              className="w-full text-right px-4 py-3 hover:bg-danger/10 transition-colors flex items-center gap-3 text-danger dark:text-danger-dark"
            >
              <span className="text-xl">🚪</span>
              <span className="text-sm font-medium">התנתק</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
