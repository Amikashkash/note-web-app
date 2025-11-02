/**
 * רכיב לניהול שיתוף קטגוריות ופתקים
 */

import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuthStore } from '@/store/authStore';

interface ShareManagementProps {
  itemType: 'category' | 'note';
  itemId: string;
  itemName: string;
  currentSharedWith: string[];
  onShare: (email: string) => Promise<void>;
  onUnshare: (userId: string) => Promise<void>;
  onClose: () => void;
}

export const ShareManagement: React.FC<ShareManagementProps> = ({
  itemType,
  itemName,
  currentSharedWith,
  onShare,
  onUnshare,
  onClose,
}) => {
  const { user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const itemTypeLabel = itemType === 'category' ? 'קטגוריה' : 'פתק';

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('נא להזין כתובת אימייל');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('כתובת אימייל לא תקינה');
      return;
    }

    // Check if trying to share with self
    if (user && email.trim() === user.email) {
      setError('לא ניתן לשתף עם עצמך');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await onShare(email.trim());
      setSuccess(`ה${itemTypeLabel} שותף בהצלחה עם ${email}`);
      setEmail('');
    } catch (error: any) {
      setError(error.message || 'שגיאה בשיתוף');
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await onUnshare(userId);
      setSuccess('המשתמש הוסר מהשיתוף בהצלחה');
    } catch (error: any) {
      setError(error.message || 'שגיאה בהסרת משתמש');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          שיתוף {itemTypeLabel}: {itemName}
        </h2>

        {/* Add new user */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
            הוסף משתמש חדש
          </h3>
          <form onSubmit={handleShare} className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="הזן אימייל של המשתמש..."
              disabled={loading}
              dir="ltr"
            />
            <Button type="submit" disabled={loading || !email.trim()} className="w-full">
              {loading ? '⏳ משתף...' : '🔗 שתף'}
            </Button>
          </form>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
              <span>✓</span>
              <span>{success}</span>
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          </div>
        )}

        {/* Currently shared with */}
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
            משותף עם ({currentSharedWith.length})
          </h3>
          {currentSharedWith.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                ה{itemTypeLabel} עדיין לא משותף עם אף אחד
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentSharedWith.map((userId) => (
                <div
                  key={userId}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {userId}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleUnshare(userId)}
                    disabled={loading}
                    className="text-xs"
                  >
                    הסר
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>💡 טיפ:</strong> משתמשים משותפים יכולים לראות ולערוך את ה{itemTypeLabel}.
            {itemType === 'category' && ' כל הפתקים בקטגוריה יהיו נגישים גם להם.'}
          </p>
        </div>

        {/* Close button */}
        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            סגור
          </Button>
        </div>
      </div>
    </Modal>
  );
};
