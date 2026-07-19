/**
 * דף הבית - תצוגת הקטגוריות והפתקים
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common';
import { CategoryList } from '@/components/category/CategoryList/CategoryList';
import { CategoryForm } from '@/components/category/CategoryForm/CategoryForm';
import { ProfileMenu } from '@/components/profile/ProfileMenu';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 overflow-x-hidden transition-colors">
      {/* Header */}
      <header className={`${theme === 'dark' ? 'bg-gradient-primary-dark' : 'bg-gradient-primary'} shadow-card mb-5 rounded-b-2xl`}>
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-5">
          {/* שורה ראשונה - לוגו, חיפוש ופרופיל */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-3xl font-bold text-white whitespace-nowrap">📝 פתקים</h1>
                <span className="text-[8px] sm:text-[10px] text-white/60">v{__APP_VERSION__}</span>
              </div>

              {/* שדה חיפוש */}
              <div className="flex-1 max-w-md hidden sm:block">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="חפש פתקים..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pr-10 pl-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70">🔍</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                      title="נקה חיפוש"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* מתג Dark Mode */}
              <button
                onClick={toggleTheme}
                className="relative inline-flex items-center h-8 w-14 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/30 hover:bg-white/40"
                title={theme === 'dark' ? 'מצב יום' : 'מצב לילה'}
              >
                <span
                  className={`absolute inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform flex items-center justify-center text-sm ${
                    theme === 'dark' ? 'right-1' : 'left-1'
                  }`}
                >
                  {theme === 'dark' ? '🌙' : '☀️'}
                </span>
              </button>

              <ProfileMenu />
            </div>
          </div>

          {/* שורה שנייה - חיפוש במובייל */}
          <div className="sm:hidden">
            <div className="relative">
              <input
                type="text"
                placeholder="חפש פתקים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 pl-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                  title="נקה חיפוש"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-2">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-200 truncate">הקטגוריות שלי</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button onClick={() => navigate('/archive')} size="sm" variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
              🗄️ ארכיון
            </Button>
            <Button onClick={() => navigate('/categories')} size="sm" variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
              ⚙ ניהול
            </Button>
            <Button onClick={() => setShowCategoryForm(true)} size="sm" className="text-xs sm:text-sm whitespace-nowrap">
              + חדש
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 sm:p-6 transition-colors">
          <CategoryList
            onCreateFirstCategory={() => setShowCategoryForm(true)}
            searchQuery={searchQuery}
          />
        </div>

        {/* Category Form Modal */}
        {showCategoryForm && (
          <CategoryForm onClose={() => setShowCategoryForm(false)} />
        )}
      </main>
    </div>
  );
};

export default Home;
