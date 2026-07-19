/**
 * AI Summary Template - Extract content from URLs using Gemini AI
 */

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import { extractContentFromUrl, summarizeText, type AIExtractionResult } from '@/services/ai/gemini';
import { getGeminiApiKey } from '@/services/api/userSettings';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

interface AISummaryTemplateProps {
  onContentExtracted?: (result: AIExtractionResult) => void;
  onError?: (error: string) => void;
}

export const AISummaryTemplate: React.FC<AISummaryTemplateProps> = ({
  onContentExtracted,
  onError,
}) => {
  const { user } = useAuthStore();
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    if (mode === 'url' && !url.trim()) {
      alert('אנא הזן כתובת URL');
      return;
    }

    if (mode === 'text' && !text.trim()) {
      alert('אנא הזן טקסט לסיכום');
      return;
    }

    if (!user) {
      alert('אנא התחבר למערכת');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Try to get user's API key (optional - will fallback to env variable)
      let apiKey: string | undefined;
      try {
        apiKey = (await getGeminiApiKey(user.uid)) || undefined;
      } catch {
        // Ignore - will use environment variable
      }

      if (mode === 'url') {
        // Extract content from URL
        const extracted = await extractContentFromUrl(url, apiKey);
        setResult(extracted);
        onContentExtracted?.(extracted);
      } else {
        // Summarize text directly
        const summary = await summarizeText(text, apiKey);
        const extracted: AIExtractionResult = {
          type: 'general',
          title: 'סיכום טקסט',
          content: {
            text: summary
          }
        };
        setResult(extracted);
        onContentExtracted?.(extracted);
      }
    } catch (error) {
      logger.error('AI Extraction Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'שגיאה בחילוץ התוכן';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      recipe: '🍳 מתכון',
      shopping: '🛒 רשימת קניות',
      article: '📰 כתבה',
      stock: '📈 מניה',
      general: '📝 כללי',
    };
    return labels[type] || '📄 תוכן';
  };

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setMode('url')}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === 'url'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🔗 מקישור
        </button>
        <button
          onClick={() => setMode('text')}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === 'text'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📝 מטקסט
        </button>
      </div>

      {/* URL Mode */}
      {mode === 'url' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            הדבק קישור לסיכום בינה מלאכותית:
          </label>
          <div className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article..."
              disabled={loading}
              className="flex-1"
              dir="ltr"
            />
            <Button onClick={handleSummarize} disabled={loading || !url.trim()}>
              {loading ? '⏳ מסכם...' : '🤖 סכם'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            ✅ עובד עם: בלוגים, מתכונים, כתבות חדשותיות
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ❌ לא עובד עם: פייסבוק, אינסטגרם, אתרי מניות (חסומים)
          </p>
        </div>
      )}

      {/* Text Mode */}
      {mode === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            הדבק טקסט לסיכום:
          </label>
          <EnhancedTextarea
            value={text}
            onChange={setText}
            placeholder="הדבק כאן טקסט ארוך שברצונך לסכם..."
            disabled={loading}
            rows={8}
            className="w-full"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 הבינה המלאכותית תסכם את הטקסט בצורה תמציתית
            </p>
            <Button onClick={handleSummarize} disabled={loading || !text.trim()}>
              {loading ? '⏳ מסכם...' : '🤖 סכם'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-2xl">🤖</div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">בינה מלאכותית עובדת...</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">מנתח את התוכן ומחלץ מידע</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-300 mb-2">
                שגיאה בחילוץ התוכן
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                {error}
              </p>
              <div className="bg-red-100 dark:bg-red-900/30 rounded p-3 text-sm text-red-800 dark:text-red-300">
                <p className="font-medium mb-2">💡 טיפים:</p>
                <ul className="space-y-1 pr-4">
                  <li>• אתרים כמו פייסבוק, אינסטגרם ומניות חוסמים גישה אוטומטית</li>
                  <li>• נסה להעתיק את התוכן ידנית ולהדביק בתבנית טקסט חופשי</li>
                  <li>• עובד הכי טוב עם בלוגים, מתכונים וכתבות רגילות</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Preview */}
      {result && !loading && !error && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✓</span>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">
                התוכן חולץ וסודר בהצלחה!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                זוהה כ: {getTypeLabel(result.type)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded p-3">
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{result.title}</p>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {result.type === 'recipe' && result.content.ingredients && (
                <p>✓ חולצו {result.content.ingredients.length} מרכיבים</p>
              )}
              {result.type === 'shopping' && result.content.items && (
                <p>✓ חולצו {result.content.items.length} פריטים</p>
              )}
              {result.type === 'article' && result.content.summary && (
                <p className="line-clamp-3">{result.content.summary}</p>
              )}
              {result.type === 'general' && result.content.text && (
                <div className="whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {result.content.text}
                </div>
              )}
              {result.type === 'general' && !result.content.text && (
                <p>✓ התוכן סודר ומוכן לשמירה</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!result && !loading && !error && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🤖</span>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">סיכום חכם עם AI</h4>
          </div>

          {mode === 'url' ? (
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>הדבק קישור לכתבה, מתכון, או פוסט</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>ה-AI יחלץ את המידע החשוב ויסדר אותו</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>התוכן ישמר אוטומטית בצורה מסודרת</span>
              </li>
            </ul>
          ) : (
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>הדבק טקסט ארוך שברצונך לסכם</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>הבינה המלאכותית תיצור סיכום תמציתי וברור</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                <span>מושלם לטקסטים ארוכים, מאמרים, או פוסטים</span>
              </li>
            </ul>
          )}

          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 <strong>טיפ:</strong> {mode === 'url'
                ? 'עובד הכי טוב עם דפים עם תוכן טקסטואלי (בלוגים, מתכונים, כתבות)'
                : 'העתק טקסט מפייסבוק, אינסטגרם או כל מקור אחר לסיכום מהיר'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
