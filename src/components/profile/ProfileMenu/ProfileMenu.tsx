/**
 * תפריט פרופיל עם אפשרויות הגדרות ומידע
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
    await signOut();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* כפתור פרופיל */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg p-1"
      >
        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || 'משתמש'}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/50"
          />
        )}
        <div className="text-right hidden lg:block">
          <p className="font-medium text-white text-sm">{user?.displayName}</p>
          <p className="text-xs text-white/80">{user?.email}</p>
        </div>
        <svg
          className={`w-4 h-4 text-white/70 transition-transform hidden lg:block ${
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
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* מידע משתמש */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600 lg:hidden">
            <p className="font-medium text-gray-800 dark:text-white text-sm">
              {user?.displayName}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">{user?.email}</p>
          </div>

          {/* פריטי תפריט */}
          <div className="py-2">
            <button
              onClick={() => handleMenuClick('/about')}
              className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span className="text-xl">ℹ️</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">אודות</span>
            </button>

            <button
              onClick={() => handleMenuClick('/whats-new')}
              className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span className="text-xl">📰</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">מה חדש</span>
            </button>

            <button
              onClick={() => handleMenuClick('/privacy')}
              className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span className="text-xl">🔒</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">מדיניות פרטיות</span>
            </button>

            <button
              onClick={() => handleMenuClick('/terms')}
              className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span className="text-xl">📄</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">תנאי שימוש</span>
            </button>

            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

            <button
              onClick={() => window.open(`mailto:amidev64@gmail.com?subject=דיווח על באג באפליקציית פתקים`, '_blank')}
              className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span className="text-xl">🐛</span>
              <span className="text-sm text-gray-700 dark:text-gray-200">דווח על תקלה</span>
            </button>

            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

            <button
              onClick={handleSignOut}
              className="w-full text-right px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 text-red-600 dark:text-red-400"
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
