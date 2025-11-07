/**
 * Share Page - Handles incoming shared content from other apps via Web Share Target API
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useNoteStore } from '@/store/noteStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';

export const Share: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { categories, subscribeToCategories } = useCategoryStore();
  const { createNote } = useNoteStore();

  // Extract shared data from URL params
  const sharedTitle = searchParams.get('title') || '';
  const sharedText = searchParams.get('text') || '';
  const sharedUrl = searchParams.get('url') || '';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load categories when user is available
  useEffect(() => {
    if (user) {
      console.log('📂 Loading categories for user:', user.uid);
      subscribeToCategories(user.uid);
      setLoading(false);
    }
  }, [user, subscribeToCategories]);

  // Auto-select first category when categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      console.log('✅ Auto-selecting first category:', categories[0].name);
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Load shared content once
  useEffect(() => {
    // If not logged in, redirect to login
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Build content from shared data
    let combinedContent = '';

    if (sharedTitle) {
      setTitle(sharedTitle);
    }

    if (sharedText) {
      combinedContent += sharedText;
    }

    if (sharedUrl) {
      if (combinedContent) {
        combinedContent += '\n\n';
      }
      combinedContent += sharedUrl;
    }

    setContent(combinedContent);
  }, [user, navigate, sharedTitle, sharedText, sharedUrl]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      alert('אנא הזן כותרת או תוכן');
      return;
    }

    if (!selectedCategoryId) {
      alert('אנא בחר קטגוריה');
      return;
    }

    if (!user) {
      alert('אנא התחבר למערכת');
      return;
    }

    setSaving(true);

    try {
      await createNote({
        title: title || 'פתק משותף',
        content,
        categoryId: selectedCategoryId,
        templateType: 'plain',
        userId: user.uid,
        tags: [],
        color: null,
        order: 0,
        sharedWith: [],
        isPinned: false,
      });

      // Navigate to home after successful save
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error saving shared note:', error);
      alert('שגיאה בשמירת הפתק');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/', { replace: true });
  };

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600 dark:text-gray-400">טוען...</p>
        </div>
      </div>
    );
  }

  // Show loading while categories are being fetched
  if (loading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">📂</div>
          <p className="text-gray-600 dark:text-gray-400">טוען קטגוריות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
            <span>🔗</span>
            <span>שמירת תוכן משותף</span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            תוכן שהתקבל משיתוף מאפליקציה אחרת
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              כותרת:
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="הזן כותרת לפתק..."
              disabled={saving}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              תוכן:
            </label>
            <EnhancedTextarea
              value={content}
              onChange={setContent}
              placeholder="תוכן הפתק..."
              disabled={saving}
              rows={10}
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              קטגוריה:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
                  disabled={saving}
                  className="justify-start"
                >
                  <span className="text-lg">{category.icon || '📁'}</span>
                  <span className="truncate">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <Button
              onClick={handleSave}
              disabled={saving || !selectedCategoryId || (!title.trim() && !content.trim())}
              className="flex-1"
            >
              {saving ? '⏳ שומר...' : '✓ שמור פתק'}
            </Button>
            <Button
              onClick={handleCancel}
              variant="secondary"
              disabled={saving}
            >
              ביטול
            </Button>
          </div>

          {/* Show warning if no category selected */}
          {categories.length === 0 && (
            <div className="space-y-3">
              <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <p className="font-medium mb-2">⚠️ לא נמצאו קטגוריות</p>
                <p className="mb-3">כדי לשמור פתקים, תחילה צריך ליצור לפחות קטגוריה אחת.</p>
                <Button
                  onClick={() => navigate('/', { replace: true })}
                  size="sm"
                  className="w-full"
                >
                  📁 עבור לעמוד הבית ליצירת קטגוריה
                </Button>
              </div>
            </div>
          )}
          {categories.length > 0 && !selectedCategoryId && (
            <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              💡 בוחר קטגוריה אוטומטית...
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 <strong>טיפ:</strong> עכשיו תוכל לשתף תוכן מכל אפליקציה ישירות לפתקים שלך!
          </p>
        </div>
      </div>
    </div>
  );
};
