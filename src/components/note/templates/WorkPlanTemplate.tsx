/**
 * תבנית תכנית עבודה (v1.44.0): רשימת סעיפים מקופלים, וגיליון לכל סעיף.
 *
 * למה: בשימוש אמיתי תכנית היא יומן של ~20 נושאים (למשל אקווריומים). כל סעיף
 * הציג שדה טקסט קטן עם גלילה, חיצים, שלושה כפתורי עיצוב וכפתור מחיקה אדום -
 * עמוס וקשה לקריאה.
 *
 * - **שורה מקופלת לכל סעיף:** הכותרת, ומתחתיה הרשומה האחרונה ביומן ו"לפני
 *   כמה זמן" (`updatedAt` של הסעיף). בלי כפתורים בשורה.
 * - **סידור בגרירה** כמו בקטגוריות ובמשימות: במגע רק אחרי לחיצה ארוכה, כך
 *   שגלילה לא מזיזה סעיף. החיצים הוסרו.
 * - **נגיעה פותחת גיליון** (`WorkPlanSectionSheet`): מצב ותובנות, יומן,
 *   "+ רשומה היום", מעבר לסעיף הקודם / הבא, ותפריט קטן לעיצוב ולהסרה.
 * - **סטטוס לסעיף** (פתוח / בעבודה / הושלם) ותג התקדמות - רק כשהמעקב פעיל
 *   בפתק (`workplanStatus`, כבוי כברירת מחדל).
 *
 * הנתונים: `utils/workplan.ts`. כל עריכה עובדת על השורות הגולמיות ושומרת
 * שדות לא מוכרים; התוכן הקיים של סעיף ישן הוא היומן, ושום דבר לא נכתב רק
 * מפתיחה.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, Plus } from 'lucide-react';
import type { WorkPlanSection } from '@/types/template';
import { parseWorkPlan } from '@/utils/templateContent';
import {
  addSection,
  latestLogLine,
  moveSection,
  patchSection,
  removeSection,
  sectionProgress,
  STATUS_LABELS,
  STATUS_TONE,
  timeAgo,
  type SectionPatch,
} from '@/utils/workplan';
import { UnparseableContent } from './UnparseableContent';
import { WorkPlanSectionSheet } from './WorkPlanSectionSheet';

interface WorkPlanTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /** המרת הפתק לטקסט חופשי, כשהתוכן לא תואם לתבנית */
  onConvertToText?: () => void;
  /**
   * טיפים מוצגים בגוף העורך. בתוך פתק פתוח הם כבויים: הם עברו לחלון "טיפים"
   * (`NoteTips`, v1.42.0). בטופס פתק חדש ובדף השיתוף הם נשארים.
   */
  hints?: boolean;
  /** סטטוס לכל סעיף ותג התקדמות (`Note.workplanStatus`) */
  statusEnabled?: boolean;
  /** הדלקה וכיבוי של הסטטוס. בלי - אין מתג (למשל בטופס פתק חדש, לפני שיש פתק) */
  onToggleStatus?: (enabled: boolean) => void;
}

/** הודעות לקורא מסך, בעברית (ברירת המחדל של הספרייה באנגלית) */
const DRAG_ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable: 'כדי להזיז סעיף: רווח כדי להרים, חיצים כדי להזיז, רווח כדי להניח, Escape כדי לבטל. Enter פותח.',
  },
  announcements: {
    onDragStart: () => 'הסעיף הורם',
    onDragOver: () => 'הסעיף הוזז',
    onDragEnd: () => 'הסעיף הונח',
    onDragCancel: () => 'ההזזה בוטלה',
  },
};

/** אחרי גרירה בעכבר הדפדפן שולח click לשורה. הוא לא אמור לפתוח את הסעיף */
const CLICK_AFTER_DRAG_MS = 300;

interface SectionRowProps {
  section: WorkPlanSection;
  dragDisabled: boolean;
  statusEnabled: boolean;
  now: number;
  onOpen: () => void;
}

const SectionRow: React.FC<SectionRowProps> = ({ section, dragDisabled, statusEnabled, now, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: dragDisabled,
  });
  // בלי גרירה dnd-kit מסמן `aria-disabled` - והשורה עדיין נפתחת. אז רק "כפתור"
  const rowAttributes = dragDisabled ? { role: 'button', tabIndex: 0 } : attributes;
  const latest = latestLogLine(section.content);
  const status = section.status ?? 'open';

  return (
    <div
      ref={setNodeRef}
      {...rowAttributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen();
      }}
      aria-label={`פתח את ${section.header || 'הסעיף'}`}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
      className={`flex items-center gap-3 px-4 py-3 min-h-[4rem] rounded-xl border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark cursor-pointer touch-manipulation select-none [-webkit-touch-callout:none] hover:bg-raised-light/60 dark:hover:bg-raised-dark/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
        isDragging ? 'shadow-e3' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <p
          className={`text-body font-semibold truncate ${
            section.header ? 'text-ink-light dark:text-ink-dark' : 'text-ink-3-light dark:text-ink-3-dark'
          }`}
        >
          {section.header || 'ללא כותרת'}
        </p>
        <p className="mt-0.5 text-body-sm text-ink-2-light dark:text-ink-2-dark truncate">
          {latest || <span className="text-ink-3-light dark:text-ink-3-dark">אין רשומות</span>}
          {section.updatedAt && (
            <span className="text-ink-3-light dark:text-ink-3-dark"> · {timeAgo(section.updatedAt, now)}</span>
          )}
        </p>
      </div>
      {/* סימן מצב, לא כפתור */}
      {statusEnabled && (
        <span className={`flex-shrink-0 text-caption px-2 py-0.5 rounded-full border ${STATUS_TONE[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      )}
      <ChevronLeft size={18} strokeWidth={1.75} className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark" aria-hidden="true" />
    </div>
  );
};

export const WorkPlanTemplate: React.FC<WorkPlanTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
  onConvertToText,
  hints = true,
  statusEnabled = false,
  onToggleStatus,
}) => {
  // פענוח שנכשל אינו "תכנית ריקה" - ראה `templateContent.ts`
  const parsed = useMemo(() => parseWorkPlan(value), [value]);
  const sections = useMemo(() => (parsed.ok ? parsed.value : []), [parsed]);
  const [openId, setOpenId] = useState<string | null>(null);
  // "לפני כמה זמן" נמדד מרגע הפתיחה של הפתק
  const [now] = useState(() => Date.now());
  const ignoreClicks = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // מגע: לחיצה ארוכה, כמו במשימות ובקטגוריות. גלילה לא מזיזה סעיף
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  if (!parsed.ok) {
    return <UnparseableContent templateType="workplan" value={value} onConvertToText={onConvertToText} />;
  }

  /** שינוי שנבנה מהשורות הגולמיות. `null` - אין שינוי, ולא שולחים כלום */
  const commit = (next: string | null) => {
    if (next !== null) onChange(next);
  };

  const patch = (id: string, change: SectionPatch) => commit(patchSection(value, id, change, Date.now()));

  const handleAdd = () => {
    const added = addSection(value, Date.now());
    if (!added) return;
    onChange(added.value);
    setOpenId(added.id);
  };

  const handleRemove = (id: string) => {
    setOpenId(null);
    commit(removeSection(value, id));
  };

  const endDrag = () => {
    window.setTimeout(() => {
      ignoreClicks.current = false;
    }, CLICK_AFTER_DRAG_MS);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag();
    if (over) commit(moveSection(value, String(active.id), String(over.id)));
  };

  const open = (id: string) => {
    if (!ignoreClicks.current) setOpenId(id);
  };

  const openIndex = sections.findIndex((section) => section.id === openId);
  const progress = sectionProgress(sections);

  return (
    <div className="space-y-3">
      {statusEnabled && sections.length > 0 && (
        <div className="rounded-xl bg-raised-light dark:bg-raised-dark p-3">
          <div className="flex items-center justify-between text-body-sm text-ink-2-light dark:text-ink-2-dark mb-2">
            <span>התקדמות</span>
            <span className="tabular-nums">
              הושלמו {progress.done} מתוך {progress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-hairline-light dark:bg-hairline-dark overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-success dark:bg-success-dark transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-ink-3-light dark:text-ink-3-dark text-center py-6 text-body">
          {readOnly ? 'אין סעיפים בתכנית' : 'אין סעיפים עדיין'}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => {
            ignoreClicks.current = true;
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={endDrag}
          accessibility={DRAG_ACCESSIBILITY}
        >
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  dragDisabled={readOnly || sections.length < 2}
                  statusEnabled={statusEnabled}
                  now={now}
                  onOpen={() => open(section.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline-light dark:border-hairline-dark text-body-sm font-medium text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          סעיף חדש
        </button>
      )}

      {hints && !readOnly && sections.length === 0 && (
        <p className="text-ink-3-light dark:text-ink-3-dark text-center text-sm">
          לחץ על "סעיף חדש" כדי להתחיל לבנות את תכנית העבודה
        </p>
      )}

      {/* מתג הסטטוס - בתחתית, כי הוא הגדרה של הפתק ולא פעולה יומיומית */}
      {onToggleStatus && !readOnly && (
        <label className="flex items-center justify-between gap-3 pt-1 text-body-sm text-ink-2-light dark:text-ink-2-dark cursor-pointer">
          <span>סטטוס לכל סעיף (פתוח / בעבודה / הושלם)</span>
          <input
            type="checkbox"
            role="switch"
            checked={statusEnabled}
            onChange={(event) => onToggleStatus(event.target.checked)}
            className="h-5 w-5 accent-brand"
          />
        </label>
      )}

      {openIndex !== -1 && (
        <WorkPlanSectionSheet
          sections={sections}
          index={openIndex}
          readOnly={readOnly}
          statusEnabled={statusEnabled}
          onNavigate={(index) => setOpenId(sections[index]?.id ?? null)}
          onClose={() => setOpenId(null)}
          onPatch={patch}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
};
