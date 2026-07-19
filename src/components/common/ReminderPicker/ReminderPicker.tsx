/**
 * קומפוננטה לבחירת תזכורת עם תאריך ושעה
 */

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import {
  isNotificationSupported,
  requestNotificationPermission,
} from '@/services/notifications/notificationService';

interface ReminderPickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const ReminderPicker: React.FC<ReminderPickerProps> = ({
  value,
  onChange,
  enabled,
  onToggle,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);

  /**
   * הפעלת תזכורת דורשת הרשאת התראות. מבקשים אותה ברגע שהמשתמש
   * מסמן את התיבה - זו פעולת המשתמש שמצדיקה את בקשת ההרשאה.
   */
  const handleToggle = async (checked: boolean) => {
    onToggle(checked);

    if (!checked) {
      setPermissionWarning(null);
      return;
    }

    if (!value) {
      setShowPicker(true);
    }

    if (!isNotificationSupported()) {
      setPermissionWarning('הדפדפן שלך לא תומך בהתראות. התזכורת תישמר אך לא תוצג התראה.');
      return;
    }

    const permission = await requestNotificationPermission();
    setPermissionWarning(
      permission === 'granted'
        ? null
        : 'ההתראות חסומות בדפדפן. התזכורת תישמר, אך כדי לקבל התראה יש לאפשר התראות בהגדרות האתר.'
    );
  };

  const formatDateTime = (date: Date | null): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      onChange(new Date(dateValue));
    }
  };

  const handleQuickSet = (hours: number) => {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    onChange(now);
    onToggle(true);
  };

  const handleClearReminder = () => {
    onChange(null);
    onToggle(false);
    setShowPicker(false);
  };

  // Convert Date to datetime-local input format
  const toDateTimeLocalString = (date: Date | null): string => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  // Get minimum datetime (now)
  const getMinDateTime = (): string => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => void handleToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ⏰ הוסף תזכורת
          </span>
        </label>

        {enabled && value && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {formatDateTime(value)}
          </span>
        )}
      </div>

      {enabled && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
          {/* Quick set buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleQuickSet(1)}
              className="text-xs"
            >
              בעוד שעה
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleQuickSet(3)}
              className="text-xs"
            >
              בעוד 3 שעות
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                onChange(tomorrow);
                onToggle(true);
              }}
              className="text-xs"
            >
              מחר ב-9:00
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPicker(!showPicker)}
              className="text-xs"
            >
              {showPicker ? 'הסתר' : 'בחר מועד'}
            </Button>
          </div>

          {/* Custom datetime picker */}
          {showPicker && (
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={toDateTimeLocalString(value)}
                onChange={handleDateTimeChange}
                min={getMinDateTime()}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleClearReminder}
                className="w-full text-xs"
              >
                ביטול תזכורת
              </Button>
            </div>
          )}

          {/* Info */}
          {permissionWarning ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">⚠️ {permissionWarning}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 תקבל התראה בדפדפן במועד שנבחר
            </p>
          )}
        </div>
      )}
    </div>
  );
};
