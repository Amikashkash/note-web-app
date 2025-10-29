/**
 * דף הבית - תצוגת הקטגוריות והפתקים
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common';
import { CategoryList } from '@/components/category/CategoryList/CategoryList';
import { CategoryForm } from '@/components/category/CategoryForm/CategoryForm';

export const Home: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">📝 אפליקציית פתקים</h1>
          </div>

          <div className="flex items-center gap-4">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="text-right">
              <p className="font-medium text-gray-800">{user?.displayName}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
            >
              התנתק
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">הקטגוריות שלי</h2>
          <Button onClick={() => setShowCategoryForm(true)}>
            + קטגוריה חדשה
          </Button>
        </div>

        {/* Categories List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <CategoryList />
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
