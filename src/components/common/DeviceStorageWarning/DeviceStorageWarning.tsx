/**
 * המכשיר לא הצליח לשמור שינוי (v1.36.1): האחסון של הדפדפן מלא או לא זמין,
 * ולכן הרשומה של `draftJournal` נשארה רק בזיכרון. כל עוד השרת לא אישר,
 * סגירה של האפליקציה הייתה מאבדת את השינוי - אז אומרים את זה בבירור,
 * ומציגים את הטקסט להעתקה. ההודעה נעלמת כשהשרת מאשר את כל השינויים.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { entriesOnlyInMemory, onJournalChange } from '@/utils/draftJournal';
import { UnsavedList } from '@/components/common/UpdateRequired/UpdateRequired';

const DEVICE_STORAGE_WARNING =
  'המכשיר לא הצליח לשמור את השינויים האחרונים - האחסון של הדפדפן מלא או חסום. הם עדיין נשלחים לשרת, אבל אם האפליקציה תיסגר לפני שיגיעו, הם עלולים ללכת לאיבוד. העתיקו אותם כדי להיות בטוחים.';

export const DeviceStorageWarning: React.FC = () => {
  const uid = useAuthStore((state) => state.user?.uid);
  const [open, setOpen] = useState(false);
  // הרשומות חיות מחוץ ל-React: כל שינוי בהן מרנדר מחדש, והרשימה נקראת ברינדור
  const [, setChanges] = useState(0);
  useEffect(() => onJournalChange(() => setChanges((count) => count + 1)), []);
  const entries = uid ? entriesOnlyInMemory(uid) : [];

  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[95] p-3 shadow-lg bg-red-50 dark:bg-red-950 text-red-950 dark:text-red-50 border-b border-red-300 dark:border-red-800"
    >
      <div className="max-w-2xl mx-auto space-y-2">
        <p className="text-sm font-medium flex items-start gap-2">
          <AlertTriangle size={18} strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden />
          {DEVICE_STORAGE_WARNING}
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="px-4 py-2 rounded-lg border border-red-400 dark:border-red-700 text-sm"
        >
          {open ? 'הסתר' : entries.length === 1 ? 'הצג להעתקה' : `הצג להעתקה (${entries.length} פתקים)`}
        </button>
        {open && (
          <UnsavedList
            entries={entries.map((entry) => ({ noteId: entry.noteId, title: entry.text.title, content: entry.text.content }))}
          />
        )}
      </div>
    </div>
  );
};
