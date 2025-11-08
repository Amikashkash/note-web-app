/**
 * Share Page - Handles incoming shared content from other apps via Web Share Target API
 * Now with smart template selection and append-to-existing-note functionality
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useNoteStore } from '@/store/noteStore';
import { useNotes } from '@/hooks/useNotes';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import { extractContentFromUrl, summarizeText } from '@/services/ai/gemini';
import { getGeminiApiKey } from '@/services/api/userSettings';
import type { TemplateType } from '@/types/note';

type ActionMode = 'new' | 'append';
type TemplateMode = 'ai' | 'plain' | 'workplan';

export const Share: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { categories, subscribeToCategories } = useCategoryStore();
  const { createNote } = useNoteStore();
  const { allNotes, updateNote } = useNotes();

  const [sharedTitle, setSharedTitle] = useState('');
  const [sharedText, setSharedText] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [workplanMainTitle, setWorkplanMainTitle] = useState(''); // For work plan library name
  const [actionMode, setActionMode] = useState<ActionMode>('new');
  const [templateMode, setTemplateMode] = useState<TemplateMode>('ai');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [swNotActive, setSwNotActive] = useState(false);
  const [checkingSW, setCheckingSW] = useState(true);
  const [swReady, setSwReady] = useState(false);

  // Detect content type
  const hasUrl = !!sharedUrl;
  const hasText = !!sharedText;

  // Check if Service Worker is ready on mount
  useEffect(() => {
    const checkServiceWorker = async () => {
      console.log('🔍 Checking Service Worker status...');

      if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Worker not supported');
        setCheckingSW(false);
        setSwReady(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const isActive = registration.active !== null;

        console.log('✅ Service Worker status:', {
          active: isActive,
          state: registration.active?.state,
        });

        setSwReady(isActive);
        setCheckingSW(false);

        if (!isActive) {
          console.warn('⚠️ Service Worker not active - share may fail with long content');
        }
      } catch (error) {
        console.error('❌ Error checking Service Worker:', error);
        setCheckingSW(false);
        setSwReady(false);
      }
    };

    checkServiceWorker();
  }, []);

  // Load shared data from cache or URL params
  useEffect(() => {
    const loadSharedData = async () => {
      const shareId = searchParams.get('shareId');

      if (shareId) {
        // Load from cache (POST method via Service Worker)
        console.log('🔍 Loading share data from cache with ID:', shareId);
        try {
          const cache = await caches.open('share-data-cache');
          const response = await cache.match(`/share-data/${shareId}`);

          if (response) {
            const data = await response.json();
            setSharedTitle(data.title || '');
            setSharedText(data.text || '');
            setSharedUrl(data.url || '');
            console.log('✅ Loaded share data from cache:', {
              titleLength: (data.title || '').length,
              textLength: (data.text || '').length,
              urlLength: (data.url || '').length,
            });

            // Clean up old cache entry
            await cache.delete(`/share-data/${shareId}`);
          } else {
            console.warn('⚠️ Share data not found in cache:', shareId);
            console.log('💡 This might happen if the Service Worker was not active during share');
          }
        } catch (error) {
          console.error('❌ Error loading share data from cache:', error);
        }
      } else {
        // Load from URL params (GET method - fallback for when SW is not active)
        console.log('📄 Loading share data from URL params (GET fallback)');
        const title = searchParams.get('title') || '';
        const text = searchParams.get('text') || '';
        const url = searchParams.get('url') || '';

        console.log('📊 URL params data:', {
          titleLength: title.length,
          textLength: text.length,
          urlLength: url.length,
        });

        setSharedTitle(title);
        setSharedText(text);
        setSharedUrl(url);

        // If all params are empty, might be arriving from direct POST that wasn't intercepted
        if (!title && !text && !url) {
          console.warn('⚠️ No share data found in URL params or cache');
          console.log('💡 Service Worker might not be active. Try refreshing the app first.');
          setSwNotActive(true);
        }
      }
    };

    loadSharedData();
  }, [searchParams]);

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

  // Load shared content and decide on smart defaults
  useEffect(() => {
    // If not logged in, redirect to login
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Set title from shared data
    if (sharedTitle) {
      setTitle(sharedTitle);
    }

    // Smart default: If URL provided, default to AI mode
    if (hasUrl) {
      setTemplateMode('ai');
    } else if (hasText) {
      setTemplateMode('plain');
    }

    // Build initial content
    let combinedContent = '';
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
  }, [user, navigate, sharedTitle, sharedText, sharedUrl, hasUrl, hasText]);

  // Smart AI processing when template changes to AI
  useEffect(() => {
    if (templateMode === 'ai' && content && !aiProcessing && !aiError) {
      handleAIProcess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateMode]);

  const handleAIProcess = async () => {
    if (!user) return;

    setAiProcessing(true);
    setAiError(null);

    try {
      // Get API key
      let apiKey: string | undefined;
      try {
        apiKey = (await getGeminiApiKey(user.uid)) || undefined;
      } catch (e) {
        // Use environment variable
      }

      if (hasUrl) {
        // Process URL with AI
        const result = await extractContentFromUrl(sharedUrl, apiKey);
        setTitle(result.title || sharedTitle || 'סיכום מקישור');

        // Format content based on type
        if (result.type === 'general' && result.content.text) {
          setContent(result.content.text);
        } else if (result.type === 'recipe') {
          let recipeText = '';
          if (result.content.ingredients) {
            recipeText += `מרכיבים:\n${result.content.ingredients.join('\n')}\n\n`;
          }
          if (result.content.steps) {
            recipeText += `הוראות הכנה:\n${result.content.steps.join('\n')}`;
          }
          setContent(recipeText);
        } else if (result.type === 'article' && result.content.summary) {
          setContent(result.content.summary);
        } else {
          setContent(JSON.stringify(result.content, null, 2));
        }
      } else if (hasText) {
        // Process text with AI
        const summary = await summarizeText(sharedText, apiKey);
        setTitle(sharedTitle || 'סיכום טקסט');
        setContent(summary);
      }
    } catch (error) {
      console.error('AI processing error:', error);
      setAiError(error instanceof Error ? error.message : 'שגיאה בעיבוד AI');
      // Keep original content on error
      let combinedContent = '';
      if (sharedText) combinedContent += sharedText;
      if (sharedUrl) {
        if (combinedContent) combinedContent += '\n\n';
        combinedContent += sharedUrl;
      }
      setContent(combinedContent);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      alert('אנא הזן כותרת או תוכן');
      return;
    }

    if (actionMode === 'new' && !selectedCategoryId) {
      alert('אנא בחר קטגוריה');
      return;
    }

    if (actionMode === 'append' && !selectedNoteId) {
      alert('אנא בחר פתק');
      return;
    }

    if (!user) {
      alert('אנא התחבר למערכת');
      return;
    }

    setSaving(true);

    try {
      if (actionMode === 'append') {
        // Append to existing note
        const existingNote = allNotes.find(n => n.id === selectedNoteId);
        if (!existingNote) {
          throw new Error('לא נמצא פתק');
        }

        let updatedContent = existingNote.content;

        // If appending to a workplan note, add as new section
        if (existingNote.templateType === 'workplan') {
          try {
            const sections = JSON.parse(existingNote.content || '[]');
            const newSection = {
              id: Date.now().toString(),
              header: title || 'קישור משותף',
              content: content,
            };
            sections.push(newSection);
            updatedContent = JSON.stringify(sections);
          } catch (e) {
            // If parsing fails, treat as plain text
            updatedContent = existingNote.content + '\n\n' + content;
          }
        } else {
          // For plain notes, just append
          updatedContent = existingNote.content + '\n\n' + content;
        }

        await updateNote(selectedNoteId, {
          ...existingNote,
          content: updatedContent,
        });
      } else {
        // Create new note
        const templateType: TemplateType = templateMode === 'workplan' ? 'workplan' : 'plain';

        // For workplan template, create a section with shared title and content
        let noteContent = content;
        let noteTitle = title || 'פתק משותף';

        if (templateMode === 'workplan') {
          // Create a work plan section from shared content
          const section = {
            id: Date.now().toString(),
            header: title || 'קישור משותף',
            content: content,
          };
          noteContent = JSON.stringify([section]);
          noteTitle = workplanMainTitle; // Use the main title user entered
        }

        await createNote({
          title: noteTitle,
          content: noteContent,
          categoryId: selectedCategoryId,
          templateType,
          userId: user.uid,
          tags: [],
          color: null,
          order: 0,
          sharedWith: [],
          isPinned: false,
        });
      }

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

  // Get notes for selected category (for append mode)
  const categoryNotes = selectedCategoryId
    ? allNotes.filter(n => n.categoryId === selectedCategoryId)
    : [];

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
            {hasUrl ? '🌐 קישור התקבל' : '📝 טקסט התקבל'}
          </p>

          {/* Service Worker Status Indicator */}
          {checkingSW && (
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <span className="animate-spin">⚙️</span>
              <span>בודק מוכנות מערכת...</span>
            </div>
          )}
          {!checkingSW && swReady && (
            <div className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
              <span>✅</span>
              <span>מוכן לשיתוף תוכן</span>
            </div>
          )}
          {!checkingSW && !swReady && (
            <div className="mt-3 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>מצב תאימות מוגבל - שיתוף טקסטים קצרים בלבד</span>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          {/* Action Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              פעולה:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActionMode('new')}
                disabled={saving || aiProcessing}
                className={`p-3 rounded-lg border-2 transition-all ${
                  actionMode === 'new'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">✨</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">פתק חדש</div>
              </button>
              <button
                onClick={() => setActionMode('append')}
                disabled={saving || aiProcessing}
                className={`p-3 rounded-lg border-2 transition-all ${
                  actionMode === 'append'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">➕</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">הוסף לפתק</div>
              </button>
            </div>
          </div>

          {/* Template Mode Selection (only for new notes) */}
          {actionMode === 'new' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                תבנית:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTemplateMode('ai')}
                  disabled={saving || aiProcessing}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    templateMode === 'ai'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">🤖</div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">AI סיכום</div>
                </button>
                <button
                  onClick={() => setTemplateMode('plain')}
                  disabled={saving || aiProcessing}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    templateMode === 'plain'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">📝</div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">טקסט חופשי</div>
                </button>
                <button
                  onClick={() => setTemplateMode('workplan')}
                  disabled={saving || aiProcessing}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    templateMode === 'workplan'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">📋</div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">תכנית עבודה</div>
                </button>
              </div>
            </div>
          )}

          {/* Service Worker Not Active Warning */}
          {swNotActive && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-2">⚠️ לא התקבל תוכן לשיתוף</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                זה קורה כאשר משתפים תוכן לפני שהאפליקציה נטענה לחלוטין. כדי לתקן את זה:
              </p>
              <ol className="text-xs text-yellow-700 dark:text-yellow-400 list-decimal list-inside space-y-1 mb-3">
                <li>פתח את האפליקציה ישירות (לא דרך שיתוף)</li>
                <li>המתן 2-3 שניות שהאפליקציה תיטען</li>
                <li>עכשיו נסה לשתף שוב את התוכן</li>
              </ol>
              <Button
                onClick={() => navigate('/', { replace: true })}
                size="sm"
                className="w-full"
              >
                🏠 פתח את האפליקציה
              </Button>
            </div>
          )}

          {/* AI Processing Status */}
          {aiProcessing && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin text-2xl">🤖</div>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-300">מעבד עם AI...</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {hasUrl ? 'מנתח קישור ומסכם' : 'מסכם טקסט'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Error */}
          {aiError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300">⚠️ {aiError}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                התוכן המקורי נשמר למטה
              </p>
            </div>
          )}

          {/* Work Plan Main Title (only for new work plan notes) */}
          {actionMode === 'new' && templateMode === 'workplan' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                שם הספרייה (כותרת ראשית) *
              </label>
              <Input
                type="text"
                value={workplanMainTitle}
                onChange={(e) => setWorkplanMainTitle(e.target.value)}
                placeholder='לדוגמה: "📚 מדריכי React" או "🎬 סרטוני הדרכה"'
                disabled={saving || aiProcessing}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 זו הכותרת הראשית של הספרייה - תוכל להוסיף עוד קישורים לאותה ספרייה מאוחר יותר
              </p>
            </div>
          )}

          {/* Title (section title for work plan, note title for others) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {actionMode === 'new' && templateMode === 'workplan' ? 'כותרת הסעיף:' : 'כותרת:'}
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                actionMode === 'new' && templateMode === 'workplan'
                  ? 'כותרת הקישור/סעיף הראשון...'
                  : 'הזן כותרת לפתק...'
              }
              disabled={saving || aiProcessing}
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
              disabled={saving || aiProcessing}
              rows={10}
            />
          </div>

          {/* Category Selection (for new notes) */}
          {actionMode === 'new' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                קטגוריה:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
                    disabled={saving || aiProcessing}
                    className="justify-start"
                  >
                    <span className="text-lg">{category.icon || '📁'}</span>
                    <span className="truncate">{category.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Note Selection (for append mode) */}
          {actionMode === 'append' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  בחר קטגוריה:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setSelectedNoteId('');
                      }}
                      variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
                      disabled={saving || aiProcessing}
                      className="justify-start text-sm"
                    >
                      <span>{category.icon || '📁'}</span>
                      <span className="truncate">{category.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {selectedCategoryId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    בחר פתק להוספה:
                  </label>
                  {categoryNotes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-2">
                      {categoryNotes.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => setSelectedNoteId(note.id)}
                          disabled={saving || aiProcessing}
                          className={`p-3 rounded-lg border-2 text-right transition-all ${
                            selectedNoteId === note.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                            {note.isPinned && '📌 '}
                            {note.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {note.content.substring(0, 60)}...
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center border dark:border-gray-700 rounded-lg">
                      אין פתקים בקטגוריה זו
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                aiProcessing ||
                (actionMode === 'new' && !selectedCategoryId) ||
                (actionMode === 'append' && !selectedNoteId) ||
                (!title.trim() && !content.trim()) ||
                (actionMode === 'new' && templateMode === 'workplan' && !workplanMainTitle.trim())
              }
              className="flex-1"
            >
              {saving ? '⏳ שומר...' : actionMode === 'append' ? '➕ הוסף לפתק' : '✓ שמור פתק'}
            </Button>
            <Button
              onClick={handleCancel}
              variant="secondary"
              disabled={saving || aiProcessing}
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
        </div>

        {/* Info */}
        <div className="mt-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">
            ✨ שיתוף חכם עם AI!
          </p>
          <ul className="text-xs text-purple-700 dark:text-purple-400 space-y-1">
            <li>🤖 סיכום AI - מסכם קישורים וטקסטים באופן אוטומטי</li>
            <li>📝 טקסט חופשי - שמירה ישירה ללא עיבוד</li>
            <li>📋 תכנית עבודה - מושלם לספריית קישורים</li>
            <li>➕ הוסף לפתק קיים - צבור קישורים באותו פתק</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
