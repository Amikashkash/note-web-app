/**
 * התנגשות בפתק פתוח (C-1): הפתק השתנה במקום אחר בזמן שהמשתמש ערך אותו,
 * והשינויים לא ניתנים למיזוג בטוח. השמירה נעצרה - שום צד לא נדרס.
 *
 * שתי אפשרויות:
 * - "טען את הגרסה העדכנית": העורך מציג את מה שבשרת, והטקסט של המשתמש
 *   נשאר גלוי למטה (עם העתקה) עד שהוא סוגר אותו.
 * - "שמור את הגרסה שלי כפתק חדש": הטקסט של המשתמש נשמר בפתק נפרד,
 *   והעורך טוען את הגרסה העדכנית.
 */

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { renderNoteContent } from '@/utils/backupFormat';
import type { Note } from '@/types/note';
import type { NoteText } from '@/utils/noteMerge';

/** הטקסט של המשתמש בצורה קריאה: רשימה כשורות, לא JSON */
const readable = (text: NoteText, templateType: Note['templateType']): string =>
  [text.title, renderNoteContent({ content: text.content, templateType } as Note)].filter(Boolean).join('\n\n');

const copy = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const NoteConflictPanel: React.FC<{
  onReload: () => void;
  onSaveMine: () => Promise<void>;
}> = ({ onReload, onSaveMine }) => {
  const [saving, setSaving] = useState(false);

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 text-amber-950 dark:text-amber-100"
    >
      <p className="font-bold">הפתק השתנה במקום אחר בזמן שערכת אותו</p>
      <p className="text-sm">
        מישהו עדכן את הפתק - במכשיר אחר, משתמש שהפתק משותף איתו, או Claude. כדי לא לדרוס אף צד, השינויים שלך
        עוד לא נשמרו והעריכה נעצרה. הטקסט שלך לא אבד. מה לעשות?
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={onReload} variant="secondary" className="flex-1">
          טען את הגרסה העדכנית
        </Button>
        <Button
          onClick={async () => {
            setSaving(true);
            try {
              await onSaveMine();
            } finally {
              setSaving(false);
            }
          }}
          isLoading={saving}
          disabled={saving}
          className="flex-1"
        >
          שמור את הגרסה שלי כפתק חדש
        </Button>
      </div>
      <p className="text-xs">
        &quot;טען את הגרסה העדכנית&quot; משאיר את הטקסט שכתבת גלוי למטה, כדי שתוכל להעתיק ממנו. עד שתבחר, מוצג
        כאן הטקסט שלך.
      </p>
    </div>
  );
};

/** אחרי "טען את הגרסה העדכנית": מה שהמשתמש כתב, להעתקה */
export const DiscardedTextPanel: React.FC<{
  text: NoteText;
  templateType: Note['templateType'];
  onDismiss: () => void;
}> = ({ text, templateType, onDismiss }) => {
  const value = readable(text, templateType);
  const [copied, setCopied] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-hairline-light dark:border-hairline-dark bg-raised-light dark:bg-raised-dark p-4 space-y-2">
      <p className="font-medium text-ink-light dark:text-ink-dark">הטקסט שכתבת (לא נשמר)</p>
      <textarea
        readOnly
        value={value}
        rows={Math.min(10, Math.max(3, value.split('\n').length))}
        className="w-full rounded-lg p-2 text-sm bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (await copy(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? '✓ הועתק' : 'העתק'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss}>
          סגור
        </Button>
      </div>
    </div>
  );
};

