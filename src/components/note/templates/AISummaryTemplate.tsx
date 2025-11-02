/**
 * AI Summary Template - Extract content from URLs using Gemini AI
 */

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { extractContentFromUrl, type AIExtractionResult } from '@/services/ai/gemini';
import { getGeminiApiKey } from '@/services/api/userSettings';
import { useAuthStore } from '@/store/authStore';

interface AISummaryTemplateProps {
  onContentExtracted?: (result: AIExtractionResult) => void;
  onError?: (error: string) => void;
}

export const AISummaryTemplate: React.FC<AISummaryTemplateProps> = ({
  onContentExtracted,
  onError,
}) => {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIExtractionResult | null>(null);

  const handleSummarize = async () => {
    if (!url.trim()) {
      alert('אנא הזן כתובת URL');
      return;
    }

    if (!user) {
      alert('אנא התחבר למערכת');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Try to get user's API key (optional - will fallback to env variable)
      let apiKey: string | undefined;
      try {
        apiKey = (await getGeminiApiKey(user.uid)) || undefined;
      } catch (e) {
        // Ignore - will use environment variable
      }

      // Extract content (will use env variable if no user key)
      const extracted = await extractContentFromUrl(url, apiKey);
      setResult(extracted);
      onContentExtracted?.(extracted);
    } catch (error) {
      console.error('AI Extraction Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'שגיאה בחילוץ התוכן';
      alert(errorMessage);
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
      {/* URL Input */}
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
          💡 עובד מצוין עם: בלוגים, מתכונים, כתבות, Instagram
        </p>
      </div>

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

      {/* Result Preview */}
      {result && !loading && (
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
              {result.type === 'general' && (
                <p>✓ התוכן סודר ומוכן לשמירה</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!result && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🤖</span>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">סיכום חכם עם AI</h4>
          </div>
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
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 <strong>טיפ:</strong> עובד הכי טוב עם דפים עם תוכן טקסטואלי (בלוגים, מתכונים, כתבות)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
