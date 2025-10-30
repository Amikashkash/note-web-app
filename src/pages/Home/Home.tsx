/**
 * דף הבית - תצוגת הקטגוריות והפתקים
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common';
import { CategoryList } from '@/components/category/CategoryList/CategoryList';
import { CategoryForm } from '@/components/category/CategoryForm/CategoryForm';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
            <h1 className="text-base sm:text-2xl font-bold text-primary truncate">📝 פתקים</h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-7 h-7 sm:w-10 sm:h-10 rounded-full"
              />
            )}
            <div className="text-right hidden sm:block">
              <p className="font-medium text-gray-800">{user?.displayName}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
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
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-2">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-800 truncate">הקטגוריות שלי</h2>
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
        <div className="bg-white rounded-lg shadow-md p-2 sm:p-6">
          <CategoryList onCreateFirstCategory={() => setShowCategoryForm(true)} />
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
