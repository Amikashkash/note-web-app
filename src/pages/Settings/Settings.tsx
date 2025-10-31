/**
 * Settings Page - User preferences and API keys
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { saveGeminiApiKey, getGeminiApiKey } from '@/services/api/userSettings';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const apiKey = await getGeminiApiKey(user.uid);
      if (apiKey) {
        setGeminiApiKey(apiKey);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    setSaved(false);

    try {
      await saveGeminiApiKey(user.uid, geminiApiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('שגיאה בשמירת ההגדרות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">⚙️ הגדרות</h1>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6">הגדרות בינה מלאכותית</h2>

          {/* Gemini API Key */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gemini API Key
              </label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXX"
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showKey ? '🙈 הסתר' : '👁️ הצג'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                מפתח API לשימוש בתכונות בינה מלאכותית (סיכום תוכן, חילוץ מתכונים וכו')
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                איך לקבל מפתח API?
              </h3>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>
                  גש ל-{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900 dark:hover:text-blue-200"
                  >
                    Google AI Studio
                  </a>
                </li>
                <li>התחבר עם חשבון Google</li>
                <li>לחץ על "Get API Key" או "Create API Key"</li>
                <li>בחר את הפרויקט שלך או צור חדש</li>
                <li>העתק את המפתח והדבק כאן</li>
              </ol>
              <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                💡 השירות בחינם עד 15 בקשות לדקה ו-1500 בקשות ליום
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={loading || !geminiApiKey.trim()}>
                {loading ? 'שומר...' : 'שמור הגדרות'}
              </Button>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">✓ נשמר בהצלחה!</span>
              )}
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              🔒 פרטיות ואבטחה
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              המפתח שלך נשמר בצורה מאובטחת ב-Firestore ומשויך למשתמש שלך בלבד. הוא משמש רק לשליחת
              בקשות ל-Gemini API בשמך. לעולם אל תשתף את המפתח שלך עם אחרים.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
