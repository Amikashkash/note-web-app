/**
 * Share Page - Handles incoming shared content from other apps via Web Share Target API
 * Now with smart template selection and append-to-existing-note functionality
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/useCategories';
import { useNotes } from '@/hooks/useNotes';
import { logger } from '@/utils/logger';
import { getErrorMessage } from '@/utils/errors';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import type { TemplateType } from '@/types/note';
import { appendToNote } from '@/services/api/notes';
import { canAppendTo } from '@/utils/templateContent';
import { getTemplateLabel } from '@/utils/templates';
import { LENGTH_LIMITS } from '@/utils/constants';

type ActionMode = 'new' | 'append';
type TemplateMode = 'plain' | 'workplan';

export const Share: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { categories, hasLoaded: categoriesLoaded } = useCategories();
  const { allNotes, createNote } = useNotes();

  const [sharedUrl, setSharedUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [workplanMainTitle, setWorkplanMainTitle] = useState(''); // For work plan library name
  const [actionMode, setActionMode] = useState<ActionMode>('new');
  const [templateMode, setTemplateMode] = useState<TemplateMode>('plain');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [swNotActive, setSwNotActive] = useState(false);
  const [checkingSW, setCheckingSW] = useState(true);
  const [swReady, setSwReady] = useState(false);

  // Detect content type
  const hasUrl = !!sharedUrl;

  // Check if Service Worker is ready on mount
  useEffect(() => {
    const checkServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        logger.warn('Service Worker not supported');
        setCheckingSW(false);
        setSwReady(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const isActive = registration.active !== null;

        setSwReady(isActive);
        setCheckingSW(false);

        if (!isActive) {
          logger.warn('Service Worker not active - share may fail with long content');
        }
      } catch (error) {
        logger.error('Error checking Service Worker:', error);
        setCheckingSW(false);
        setSwReady(false);
      }
    };

    checkServiceWorker();
  }, []);

  /**
   * שומר את הנתונים המשותפים וממלא מהם את הטופס.
   * נקרא פעם אחת כשהנתונים מגיעים. קודם זה קרה ב-effect שרץ מחדש בכל
   * שינוי של המשתמש, ודרס את מה שהמשתמש כבר ערך בטופס.
   */
  const applySharedData = (sharedTitleValue: string, text: string, url: string) => {
    setSharedUrl(url);

    if (sharedTitleValue) {
      setTitle(sharedTitleValue);
    }
    setContent([text, url].filter(Boolean).join('\n\n'));
  };

  // Load shared data from cache or URL params
  useEffect(() => {
    const loadSharedData = async () => {
      const shareId = searchParams.get('shareId');

      if (shareId) {
        // שיתוף שהגיע כ-POST ונשמר ב-cache ע"י ה-Service Worker
        try {
          const cache = await caches.open('share-data-cache');
          const response = await cache.match(`/share-data/${shareId}`);

          if (response) {
            const data = await response.json();
            applySharedData(data.title || '', data.text || '', data.url || '');

            await cache.delete(`/share-data/${shareId}`);
          } else {
            logger.warn('Share data not found in cache:', shareId);
          }
        } catch (error) {
          logger.error('Error loading share data from cache:', error);
        }
      } else {
        // נפילה לפרמטרים ב-URL, למקרה שה-Service Worker לא היה פעיל
        const title = searchParams.get('title') || '';
        const text = searchParams.get('text') || '';
        const url = searchParams.get('url') || '';

        applySharedData(title, text, url);

        if (!title && !text && !url) {
          logger.warn('No share data found in URL params or cache');
          setSwNotActive(true);
        }
      }
    };

    loadSharedData();
  }, [searchParams]);

  // הקטגוריה הראשונה נבחרת כברירת מחדל עד שהמשתמש בוחר אחרת.
  // נגזר ברינדור ולא נכתב ל-state מתוך effect.
  const activeCategoryId = selectedCategoryId || categories[0]?.id || '';

  // משתמש לא מחובר מועבר להתחברות
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      alert('אנא הזן כותרת או תוכן');
      return;
    }

    if (actionMode === 'new' && !activeCategoryId) {
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
        // ההוספה נעשית על התוכן העדכני בשרת ובצורה שמתאימה לסוג הפתק -
        // פריט ברשימה, סעיף בתכנית עבודה, פסקה בטקסט. ראה `appendSnippet`.
        const result = await appendToNote(selectedNoteId, { title, text: content });

        if (!result.ok) {
          const target = allNotes.find((note) => note.id === selectedNoteId);
          const label = target ? getTemplateLabel(target.templateType) : 'הזה';
          alert(
            result.reason === 'unsupported'
              ? `לא ניתן להוסיף תוכן לפתק מסוג ${label}`
              : result.reason === 'unparseable'
                ? 'התוכן של הפתק שנבחר לא תואם לסוג שלו, ולכן לא נוסף אליו דבר. פתח את הפתק כדי להמיר אותו לטקסט'
                : 'אנא הזן כותרת או תוכן'
          );
          setSaving(false);
          return;
        }
      } else {
        // Create new note
        const templateType: TemplateType = templateMode === 'workplan' ? 'workplan' : 'plain';

        // For workplan template, create a section with shared title and content
        let noteContent = content;
        let noteTitle = title.trim() || 'פתק משותף';

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

        // כותרת של דף אינטרנט משותף ארוכה לעיתים קרובות מהמגבלה
        noteTitle = noteTitle.slice(0, LENGTH_LIMITS.NOTE_TITLE);

        await createNote({
          title: noteTitle,
          content: noteContent,
          categoryId: activeCategoryId,
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
      logger.error('Error saving shared note:', error);
      alert(getErrorMessage(error));
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/', { replace: true });
  };

  // השדה "כותרת" הוא כותרת הפתק רק ביצירת פתק רגיל. בתכנית עבודה הוא
  // כותרת הסעיף, ובהוספה לפתק קיים הוא חלק מהפריט שנוסף.
  const isNoteTitle = actionMode === 'new' && templateMode !== 'workplan';

  // Get notes for selected category (for append mode)
  const categoryNotes = activeCategoryId
    ? allNotes.filter(n => n.categoryId === activeCategoryId)
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
  if (!categoriesLoaded) {
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
                disabled={saving}
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
                disabled={saving}
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTemplateMode('plain')}
                  disabled={saving}
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
                  disabled={saving}
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

          {/* Work Plan Main Title (only for new work plan notes) */}
          {actionMode === 'new' && templateMode === 'workplan' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                שם הספרייה (כותרת ראשית) *
              </label>
              <Input
                type="text"
                value={workplanMainTitle}
                onChange={(e) =>
                  setWorkplanMainTitle(e.target.value.slice(0, LENGTH_LIMITS.NOTE_TITLE))
                }
                maxLength={LENGTH_LIMITS.NOTE_TITLE}
                placeholder='לדוגמה: "📚 מדריכי React" או "🎬 סרטוני הדרכה"'
                disabled={saving}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 זו הכותרת הראשית של הספרייה - תוכל להוסיף עוד קישורים לאותה ספרייה מאוחר יותר
              </p>
            </div>
          )}

          {/* Title (section title for work plan, note title for others) */}
          {isNoteTitle && title.length > LENGTH_LIMITS.NOTE_TITLE && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mb-2">
              הכותרת תקוצר ל-{LENGTH_LIMITS.NOTE_TITLE} תווים
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {actionMode === 'new' && templateMode === 'workplan' ? 'כותרת הסעיף:' : 'כותרת:'}
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(
                  isNoteTitle ? e.target.value.slice(0, LENGTH_LIMITS.NOTE_TITLE) : e.target.value
                )
              }
              maxLength={isNoteTitle ? LENGTH_LIMITS.NOTE_TITLE : undefined}
              placeholder={
                actionMode === 'new' && templateMode === 'workplan'
                  ? 'כותרת הקישור/סעיף הראשון...'
                  : 'הזן כותרת לפתק...'
              }
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
                    variant={activeCategoryId === category.id ? 'primary' : 'secondary'}
                    disabled={saving}
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
                      variant={activeCategoryId === category.id ? 'primary' : 'secondary'}
                      disabled={saving}
                      className="justify-start text-sm"
                    >
                      <span>{category.icon || '📁'}</span>
                      <span className="truncate">{category.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {activeCategoryId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    בחר פתק להוספה:
                  </label>
                  {categoryNotes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-2">
                      {categoryNotes.map((note) => {
                        const appendable = canAppendTo(note.templateType);
                        return (
                        <button
                          key={note.id}
                          onClick={() => setSelectedNoteId(note.id)}
                          disabled={saving || !appendable}
                          title={appendable ? undefined : `לא ניתן להוסיף לפתק מסוג ${getTemplateLabel(note.templateType)}`}
                          className={`p-3 rounded-lg border-2 text-right transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
                            {appendable
                              ? `${getTemplateLabel(note.templateType)} · ${note.content.substring(0, 60)}...`
                              : `${getTemplateLabel(note.templateType)} · לא ניתן להוסיף לסוג זה`}
                          </div>
                        </button>
                        );
                      })}
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
                (actionMode === 'new' && !activeCategoryId) ||
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
        </div>

        {/* Info */}
        <div className="mt-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">
            ✨ שיתוף מהיר
          </p>
          <ul className="text-xs text-purple-700 dark:text-purple-400 space-y-1">
            <li>📝 טקסט חופשי - שמירה ישירה ללא עיבוד</li>
            <li>📋 תכנית עבודה - מושלם לספריית קישורים</li>
            <li>➕ הוסף לפתק קיים - צבור קישורים באותו פתק</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
