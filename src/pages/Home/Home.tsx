/**
 * דף הבית - תצוגת הקטגוריות והפתקים
 */

import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { Archive, Search, Settings, X } from "lucide-react";
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
    <div className="min-h-screen bg-app-light dark:bg-app-dark overflow-x-hidden transition-colors">
      {/* Header */}
      <header className={`bg-surface-light dark:bg-surface-dark border-b border-hairline-light dark:border-hairline-dark mb-5`}>
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-5">
          {/* שורה ראשונה - לוגו, חיפוש ופרופיל */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-3xl font-bold text-ink-light dark:text-ink-dark whitespace-nowrap">פתקים</h1>
                <span className="text-[8px] sm:text-[10px] text-ink-light dark:text-ink-dark/60">v{__APP_VERSION__}</span>
              </div>

              {/* שדה חיפוש */}
              <div className="flex-1 max-w-md hidden sm:block">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="חפש פתקים..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 ps-10 pe-10 rounded-lg text-body bg-raised-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark placeholder:text-ink-3-light dark:placeholder:text-ink-3-dark focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all"
                  />
                  <Search size={18} strokeWidth={1.75} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark pointer-events-none" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
                      title="נקה חיפוש"
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* מתג Dark Mode */}
              <button
                onClick={toggleTheme}
                className="relative inline-flex items-center h-8 w-14 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 bg-raised-light dark:bg-raised-dark hover:bg-hairline-light dark:hover:bg-hairline-dark"
                title={theme === 'dark' ? 'מצב יום' : 'מצב לילה'}
              >
                <span
                  className={`absolute inline-block h-6 w-6 rounded-full bg-surface-light dark:bg-surface-dark shadow-lg transition-transform flex items-center justify-center text-sm ${
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
                className="w-full h-11 ps-10 pe-10 rounded-lg text-body bg-raised-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark placeholder:text-ink-3-light dark:placeholder:text-ink-3-dark focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all text-sm"
              />
              <Search size={18} strokeWidth={1.75} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
                  title="נקה חיפוש"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-2">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-ink-light dark:text-ink-dark truncate">הקטגוריות שלי</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button onClick={() => navigate('/archive')} size="sm" variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
              <Archive size={18} strokeWidth={1.75} />ארכיון
            </Button>
            <Button onClick={() => navigate('/categories')} size="sm" variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
              <Settings size={18} strokeWidth={1.75} />ניהול
            </Button>
            <Button onClick={() => setShowCategoryForm(true)} size="sm" className="text-xs sm:text-sm whitespace-nowrap">
              + חדש
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-e2 p-2 sm:p-6 transition-colors">
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
