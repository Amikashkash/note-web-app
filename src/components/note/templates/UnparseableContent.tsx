/**
 * הודעה לתוכן שהתבנית לא הצליחה לפענח
 *
 * מוצגת במקום התבנית כשהתוכן השמור לא תואם לה - למשל פתק טקסט
 * שהוגדר כרשימת משימות. התוכן עצמו לא נוגעים בו: הוא מוצג כמו שהוא,
 * וההמרה לטקסט היא פעולה מפורשת של המשתמש. בגרסה קודמת התבנית
 * "איתחלה" תוכן כזה לרשימה ריקה ומחקה אותו.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { getTemplateLabel } from '@/utils/templates';
import type { TemplateType } from '@/types/note';

/** אורך התצוגה המקדימה - מספיק כדי לזהות את התוכן */
const PREVIEW_LENGTH = 500;

interface UnparseableContentProps {
  templateType: TemplateType;
  value: string;
  /** המרת הפתק לטקסט חופשי. בלעדיו לא מוצג כפתור ההמרה. */
  onConvertToText?: () => void;
}

export const UnparseableContent: React.FC<UnparseableContentProps> = ({
  templateType,
  value,
  onConvertToText,
}) => {
  const preview =
    value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}…` : value;

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-soft dark:bg-danger-soft-dark p-4 space-y-3"
    >
      <div className="flex items-start gap-2 text-ink-light dark:text-ink-dark">
        <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-danger dark:text-danger-dark" />
        <p className="text-body-sm">
          לא ניתן להציג את התוכן של הפתק הזה כ{getTemplateLabel(templateType)}. התוכן לא נמחק
          והוא מוצג כאן כמו שהוא.
        </p>
      </div>

      <pre
        dir="auto"
        className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-light dark:bg-surface-dark p-3 text-body-sm text-ink-2-light dark:text-ink-2-dark"
      >
        {preview}
      </pre>

      {onConvertToText && (
        <Button type="button" variant="outline" size="sm" onClick={onConvertToText}>
          המר לטקסט
        </Button>
      )}
    </div>
  );
};
