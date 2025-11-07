/**
 * דף הבית - תצוגת הקטגוריות והפתקים
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common';
import { CategoryList } from '@/components/category/CategoryList/CategoryList';
import { CategoryForm } from '@/components/category/CategoryForm/CategoryForm';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
            <div className="flex flex-col">
              <h1 className="text-base sm:text-2xl font-bold text-primary dark:text-blue-400 truncate">📝 פתקים</h1>
              <span className="text-[8px] sm:text-[10px] text-gray-400 dark:text-gray-500">v1.0.2</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            {/* כפתור מצב לילה/יום */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'dark' ? 'מצב יום' : 'מצב לילה'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-7 h-7 sm:w-10 sm:h-10 rounded-full"
              />
            )}
            <div className="text-right hidden sm:block">
              <p className="font-medium text-gray-800 dark:text-gray-200">{user?.displayName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4"
            >
              התנתק
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="container mx-auto px-3 sm:px-4 pb-3 pt-1">
          <div className="relative">
            <input
              type="text"
              placeholder="חפש פתקים לפי כותרת או תוכן..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pr-10 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
              🔍
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            )}
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
