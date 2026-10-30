/**
 * "יש גרסה חדשה" (D4a, `minClientVersion`): כשהגרסה הרצה ישנה מדי, היא לא
 * כותבת יותר (`services/api/writeGate.ts`), וכאן המשתמש רואה למה ומה לעשות.
 *
 * טקסט שנכתב ולא נשמר לא נעלם בשקט:
 * - הוא מוצג כאן, להעתקה, גם אם הפתק כבר נסגר.
 * - הוא נשמר ב-localStorage כבר כשהוא נעצר (`utils/unsavedStash.ts`), והגרסה
 *   החדשה מציגה אותו שוב (`RecoveredText`). הוא לא נשמר לפתק אוטומטית: הוא נכתב בפורמט
 *   של הגרסה הישנה, וזה בדיוק מה שלא רוצים לכתוב.
 */

import React, { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useAppVersionStore, type UnsavedText } from '@/store/appVersionStore';
import { WRITES_BLOCKED_MESSAGE } from '@/services/api/writeGate';
import { logger } from '@/utils/logger';
import { clearStash, readStash, stashUnsaved } from '@/utils/unsavedStash';

const copyText = async (text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // בלי הרשאת clipboard: מסמנים את הטקסט, כדי שהעתקה ידנית תהיה לחיצה אחת
    fallback?.select();
    return false;
  }
};

const UnsavedEntry: React.FC<{ text: UnsavedText }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const [area, setArea] = useState<HTMLTextAreaElement | null>(null);
  const full = [text.title, text.content].filter(Boolean).join('\n\n');

  return (
    <div className="rounded-lg border border-hairline-light dark:border-hairline-dark p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{text.title || 'ללא כותרת'}</span>
        <button
          type="button"
          onClick={async () => setCopied(await copyText(full, area))}
          className="flex items-center gap-1 text-caption px-2 py-1 rounded border border-hairline-light dark:border-hairline-dark"
        >
          <Copy size={14} strokeWidth={1.75} />
          {copied ? 'הועתק' : 'העתק'}
        </button>
      </div>
      <textarea
        ref={setArea}
        readOnly
        value={full}
        rows={4}
        className="w-full text-sm p-2 rounded bg-raised-light dark:bg-raised-dark text-ink-light dark:text-ink-dark"
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
};

export const UnsavedList: React.FC<{ entries: UnsavedText[] }> = ({ entries }) => (
  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
    {entries.map((entry) => (
      <UnsavedEntry key={entry.noteId} text={entry} />
    ))}
  </div>
);

/** טעינה מחדש לגרסה החדשה: קודם שומרים בצד את מה שלא נשמר */
const refreshToNewVersion = async (unsaved: UnsavedText[]) => {
  // כבר נשמר כשנעצר; שוב ליתר ביטחון
  stashUnsaved(unsaved);
  try {
    // מבקשים מה-Service Worker לבדוק עדכון לפני הטעינה, עם תקרת זמן
    const registration = await navigator.serviceWorker?.getRegistration();
    await Promise.race([registration?.update(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch (error) {
    logger.warn('Service worker update check failed:', error);
  }
  window.location.reload();
};

export const UpdateRequired: React.FC = () => {
  const blocked = useAppVersionStore((state) => state.writesBlocked);
  const unsaved = Object.values(useAppVersionStore((state) => state.unsaved));
  const [showUnsaved, setShowUnsaved] = useState(false);

  if (!blocked) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[100] p-3 shadow-lg bg-amber-50 dark:bg-amber-950 text-amber-950 dark:text-amber-50 border-b border-amber-300 dark:border-amber-800"
    >
      <div className="max-w-2xl mx-auto space-y-2">
        <p className="text-sm font-medium">{WRITES_BLOCKED_MESSAGE}</p>
        {unsaved.length > 0 && (
          <p className="text-sm">
            {unsaved.length === 1 ? 'יש פתק אחד עם שינויים שלא נשמרו.' : `יש ${unsaved.length} פתקים עם שינויים שלא נשמרו.`}{' '}
            הם יוצגו שוב אחרי הרענון, ואפשר גם להעתיק אותם עכשיו.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshToNewVersion(unsaved)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
          >
            <RefreshCw size={16} strokeWidth={2} />
            רענן לגרסה החדשה
          </button>
          {unsaved.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnsaved((open) => !open)}
              className="px-4 py-2 rounded-lg border border-amber-400 dark:border-amber-700 text-sm"
            >
              {showUnsaved ? 'הסתר' : 'הצג מה שלא נשמר'}
            </button>
          )}
        </div>
        {showUnsaved && <UnsavedList entries={unsaved} />}
      </div>
    </div>
  );
};

/** אחרי הרענון: הטקסט ששמרנו בצד לפני הטעינה, להעתקה. לא נשמר לפתק אוטומטית */
export const RecoveredText: React.FC = () => {
  const [entries, setEntries] = useState<UnsavedText[]>(readStash);

  if (entries.length === 0) return null;

  const dismiss = () => {
    clearStash();
    setEntries([]);
  };

  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-[100] p-3 shadow-lg bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark border-t border-hairline-light dark:border-hairline-dark"
    >
      <div className="max-w-2xl mx-auto space-y-2">
        <p className="text-sm font-medium">
          לפני העדכון היו שינויים שלא נשמרו. הם לא נוספו לפתקים - העתיקו מה שצריך והדביקו בפתק.
        </p>
        <UnsavedList entries={entries} />
        <button
          type="button"
          onClick={() => {
            if (window.confirm('לסגור? הטקסט הזה לא יוצג שוב.')) dismiss();
          }}
          className="px-4 py-2 rounded-lg border border-hairline-light dark:border-hairline-dark text-sm"
        >
          סגור
        </button>
      </div>
    </div>
  );
};
