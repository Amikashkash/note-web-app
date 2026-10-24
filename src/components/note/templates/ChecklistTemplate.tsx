/**
 * תבנית רשימת משימות - To-Do List
 *
 * המשימות נשמרות כ-JSON במחרוזת אחת (`value`), ולכן כל שינוי בונה מחדש
 * את כל הרשימה ומוסר אותה ב-`onChange`. חשוב: `items` נגזר מ-`value`
 * ולכן הוא מתעדכן רק ברינדור הבא - שתי קריאות עדכון באותו אירוע היו
 * מתבססות על אותו מצב ישן, והשנייה הייתה דורסת את הראשונה. לכן כל
 * פעולה חייבת להסתכם בקריאה אחת ל-`updateItem`.
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDownWideNarrow,
  CalendarDays,
  ChevronDown,
  Clock,
  Flag,
  GripVertical,
  Repeat,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useNotificationOptIn } from '@/hooks/useNotificationOptIn';
import {
  getDateStatus,
  formatDueLabel,
  DATE_STATUS_TEXT_CLASS,
  DATE_STATUS_BORDER_CLASS,
} from './dueDate';

import type { ChecklistItem, RepeatRule, TaskPriority } from '@/types/template';
import { openTasksFirst, parseChecklist } from '@/utils/templateContent';
import { moveTask, sortTasksByPriority } from '@/utils/checklistOrder';
import { UnparseableContent } from './UnparseableContent';

export type { ChecklistItem, RepeatRule };

const REPEAT_LABELS: Record<RepeatRule, string> = {
  daily: 'כל יום',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
  yearly: 'כל שנה',
};

/** רמת עדיפות לתצוגה. 'normal' לא נשמר - הוא היעדר השדה */
type PriorityLevel = TaskPriority | 'normal';

const PRIORITY_LEVELS: PriorityLevel[] = ['urgent', 'normal', 'low'];

const PRIORITY_META: Record<PriorityLevel, { label: string; flagClass: string; filled: boolean }> = {
  urgent: { label: 'דחוף', flagClass: 'text-danger dark:text-danger-dark', filled: true },
  normal: { label: 'רגיל', flagClass: 'text-ink-3-light dark:text-ink-3-dark', filled: false },
  low: { label: 'נמוך', flagClass: 'text-ink-2-light dark:text-ink-2-dark', filled: true },
};

const levelOf = (item: ChecklistItem): PriorityLevel => item.priority ?? 'normal';

/** האייקון של רמה: דגל מלא בצבע הרמה, ורגילה - קו מתאר בלבד */
const PriorityFlag: React.FC<{ level: PriorityLevel; size?: number }> = ({ level, size = 18 }) => (
  <Flag
    size={size}
    strokeWidth={1.75}
    className={PRIORITY_META[level].flagClass}
    fill={PRIORITY_META[level].filled ? 'currentColor' : 'none'}
  />
);


interface ChecklistTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /** המרת הפתק לטקסט חופשי, כשהתוכן לא תואם לתבנית */
  onConvertToText?: () => void;
}

interface DuePickerProps {
  inputId: string;
  type: 'date' | 'time';
  value: string;
  Icon: LucideIcon;
  colorClass: string;
  title: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

/**
 * בורר תאריך/שעה: הקלט עצמו שקוף ופרוס מעל האייקון, כדי שלחיצה על
 * האייקון תפתח את בורר המערכת. אותו מבנה שימש פעמיים - לתאריך ולשעה.
 */
const DuePicker: React.FC<DuePickerProps> = ({
  inputId,
  type,
  value,
  Icon,
  colorClass,
  title,
  onChange,
  onClear,
}) => (
  <div className="relative flex-shrink-0 flex items-center gap-1">
    <input
      id={inputId}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute left-0 top-0 w-8 h-8 opacity-0 cursor-pointer"
      style={{ zIndex: 10 }}
    />
    <label
      htmlFor={inputId}
      className={`cursor-pointer pointer-events-none ${colorClass}`}
      title={title}
    >
      <Icon size={20} strokeWidth={1.75} />
    </label>
    {value && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="text-ink-3-light dark:text-ink-3-dark hover:text-danger relative z-20"
        title={type === 'date' ? 'הסר תאריך' : 'הסר שעה'}
      >
        <X size={14} strokeWidth={2} />
      </button>
    )}
  </div>
);

interface SortableRowProps {
  id: string;
  disabled: boolean;
  className: string;
  /** תוכן השורה. מקבל את ידית הגרירה, כדי למקם אותה בשורה הראשונה */
  children: (handle: React.ReactNode) => React.ReactNode;
}

/**
 * שורת משימה שאפשר לגרור. רק הידית מתחילה גרירה, כך שהקלדה בשדה, סימון
 * וגלילה בנייד ממשיכים לעבוד כרגיל. `touch-none` על הידית: בלי זה הדפדפן
 * בנייד גולל את הדף במקום לגרור.
 */
const SortableRow: React.FC<SortableRowProps> = ({ id, disabled, className, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="flex-shrink-0 -ms-1 p-1 touch-none cursor-grab active:cursor-grabbing text-ink-3-light dark:text-ink-3-dark hover:text-ink-2-light dark:hover:text-ink-2-dark"
      title="גרור לשינוי הסדר"
      aria-label="גרור לשינוי הסדר"
    >
      <GripVertical size={18} strokeWidth={1.75} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`${className}${isDragging ? ' shadow-lg' : ''}`}
    >
      {children(handle)}
    </div>
  );
};

/** הודעות לקורא מסך, בעברית (ברירת המחדל של הספרייה באנגלית) */
const DRAG_ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable: 'כדי להזיז משימה: רווח כדי להרים, חיצים כדי להזיז, רווח כדי להניח, Escape כדי לבטל.',
  },
  announcements: {
    onDragStart: () => 'המשימה הורמה',
    onDragOver: () => 'המשימה הוזזה',
    onDragEnd: () => 'המשימה הונחה',
    onDragCancel: () => 'ההזזה בוטלה',
  },
};

export const ChecklistTemplate: React.FC<ChecklistTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
  onConvertToText,
}) => {
  // מזהה המשימה שצריכה לקבל פוקוס אחרי הרינדור הבא.
  // ref ולא state: זו פעולת DOM בלבד ואינה משפיעה על מה שמוצג,
  // ולכן אין סיבה לגרור בגללה רינדור נוסף.
  const pendingFocusIdRef = useRef<string | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { warning: notificationWarning, ensureEnabled } = useNotificationOptIn();

  // פענוח שנכשל אינו "רשימה ריקה" - ראה `templateContent.ts`
  const parsed = useMemo(() => parseChecklist(value), [value]);
  const items = useMemo<ChecklistItem[]>(() => (parsed.ok ? parsed.value : []), [parsed]);
  // משימות שבוצעו יורדות לסוף הרשימה. תצוגה בלבד - העריכות עובדות לפי מזהה על `items`
  // המשימות שבוצעו מקופלות לשורה אחת "בוצעו (N)". תצוגה בלבד: לא נשמר ולא
  // משנה את הפתק, וכל פתיחה של הפתק מתחילה מקופלת
  const [showDone, setShowDone] = useState(false);
  // סינון לפי רמה - תצוגה בלבד, כמו "בוצעו". (המיון לפי עדיפות הוא פעולה שנשמרת)
  const [levelFilter, setLevelFilter] = useState<PriorityLevel | null>(null);
  const [priorityMenuFor, setPriorityMenuFor] = useState<string | null>(null);

  // הכלים של העדיפות מופיעים רק כשלמשימה כלשהי יש עדיפות. בלעדיהם - בלי סינון
  const hasPriorities = items.some((item) => item.priority !== undefined);
  const filter = hasPriorities ? levelFilter : null;
  const shownItems = useMemo(
    () => openTasksFirst(filter ? items.filter((item) => levelOf(item) === filter) : items),
    [items, filter]
  );
  const openItems = shownItems.filter((item) => !item.completed);
  const doneItems = shownItems.filter((item) => item.completed);

  const sensors = useSensors(
    // מרחק קטן לפני שהגרירה מתחילה: לחיצה רגילה על הידית לא מזיזה כלום
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // רץ אחרי כל רינדור, כי אי אפשר לדעת מראש מתי שדה המשימה החדשה יצורף ל-DOM
  useEffect(() => {
    const pendingId = pendingFocusIdRef.current;
    if (!pendingId) return;

    const input = inputRefs.current[pendingId];
    if (input) {
      input.focus();
      pendingFocusIdRef.current = null;
    }
  });

  const commit = (updated: ChecklistItem[]) => onChange(JSON.stringify(updated));

  /**
   * רשימת משימות ריקה מקבלת שורה ראשונה אוטומטית.
   *
   * רשימה בלי משימה אחת לפחות היא חסרת משמעות, ולכן הלחיצה על "הוסף
   * משימה" רק כדי להתחיל הייתה מיותרת. בכוונה בלי פוקוס: פתיחת פתק
   * קיים הייתה מקפיצה את המקלדת בנייד בכל פעם.
   */
  useEffect(() => {
    // רק תוכן ריק לגמרי. `[]` (רשימה שכל משימותיה נמחקו) נשאר כמו שהוא,
    // ותוכן שלא פוענח לעולם לא נדרס - זה מה שמחק פתקים בגרסה קודמת.
    if (readOnly || value !== '') return;

    onChange(
      JSON.stringify([{ id: Date.now().toString(), text: '', completed: false }])
    );
  }, [readOnly, value, onChange]);

  /**
   * עדכון משימה בודדת. נקודת המעבר היחידה לשינוי פריט - קריאה אחת
   * לאירוע, כדי שלא ייווצר מצב שבו עדכון שני מתבסס על מצב שכבר התיישן.
   */
  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAddItem = () => {
    const newId = Date.now().toString();
    // משימה חדשה היא רגילה, ותחת סינון לרמה אחרת הייתה נעלמת מיד
    setLevelFilter(null);
    commit([...items, { id: newId, text: '', completed: false }]);
    pendingFocusIdRef.current = newId;
  };

  const handleToggleItem = (id: string, completed: boolean) => {
    updateItem(id, { completed: !completed });
  };

  const handleUpdateText = (id: string, text: string) => {
    updateItem(id, { text });
  };

  /** תאריך שנקבע ביד הוא בסיס חדש לסדרה: `repeatBase` הישן כבר לא תקף */
  const handleUpdateDueDate = (id: string, dueDate: string) => {
    updateItem(id, { dueDate: dueDate || undefined, repeatBase: undefined });
  };

  const handleUpdateDueTime = (id: string, dueTime: string) => {
    updateItem(id, { dueTime: dueTime || undefined });

    // שעה היא מה שהופך תאריך יעד לתזכורת אמיתית, ולכן זו הנקודה לבקש
    // הרשאה. תאריך לבדו נשאר ויזואלי ולא מצדיק בקשה.
    if (dueTime) {
      void ensureEnabled();
    }
  };

  /**
   * ניקוי התאריך מסיר גם את השעה ואת החזרה - שעה בלי תאריך היא חסרת
   * משמעות, וחזרה בלי מועד בסיס אין לה ממה להתגלגל.
   */
  const handleClearDue = (id: string) => {
    updateItem(id, { dueDate: undefined, dueTime: undefined, repeat: undefined, repeatBase: undefined });
  };

  const handleUpdateRepeat = (id: string, repeat: string) => {
    updateItem(id, { repeat: repeat ? (repeat as RepeatRule) : undefined, repeatBase: undefined });
  };

  /**
   * עובד גם בלי מצב עריכה, כמו הסימון כבוצע: אותו `onChange`, ולכן אותה
   * הגנה מדריסה (`useNoteSync` - מיזוג, ובזמן התנגשות השינוי לא נשלח).
   */
  const handleSetPriority = (id: string, level: PriorityLevel) => {
    setPriorityMenuFor(null);
    updateItem(id, { priority: level === 'normal' ? undefined : level });
  };

  /** סידור חד-פעמי לפי עדיפות, שנשמר כמו גרירה. אחר כך הרשימה לא נשמרת ממוינת */
  const handleSortByPriority = () => {
    const sorted = sortTasksByPriority(items);
    if (sorted) commit(sorted);
  };

  const handleDeleteItem = (id: string) => {
    commit(items.filter((item) => item.id !== id));
  };

  /** גרירה הסתיימה: רק בתוך אותה קבוצה (פתוחות / בוצעו), ראו `moveTask` */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const moved = moveTask(items, String(active.id), String(over.id));
    if (moved) commit(moved);
  };

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const completedPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  /** שורת משימה אחת */
  const renderItem = (item: ChecklistItem) => {
    const dateStatus = getDateStatus(item.dueDate, item.dueTime);
    const dueLabel = formatDueLabel(item.dueDate, item.dueTime);

    const borderColor = item.completed
      ? 'border-success/30'
      : dateStatus
      ? DATE_STATUS_BORDER_CLASS[dateStatus]
      : 'border-hairline-light dark:border-hairline-dark';

    const dateColor = item.dueDate && dateStatus
      ? DATE_STATUS_TEXT_CLASS[dateStatus]
      : 'text-ink-3-light dark:text-ink-3-dark';

    return (
      <SortableRow
        key={item.id}
        id={item.id}
        disabled={readOnly}
        className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-colors ${
          item.completed
            ? 'bg-success/10 ' + borderColor
            : 'bg-surface-light dark:bg-surface-dark ' +
              borderColor +
              ' hover:border-ink-3-light dark:hover:border-ink-3-dark'
        }`}
      >
        {(handle) => (
          <>
            <div className="flex items-center gap-3">
              {handle}

              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggleItem(item.id, item.completed)}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  item.completed
                    ? 'bg-success border-success dark:bg-success-dark dark:border-success-dark'
                    : 'bg-surface-light dark:bg-raised-dark border-hairline-light dark:border-hairline-dark hover:border-success dark:hover:border-success-dark'
                }`}
              >
                {item.completed && <span className="text-white text-sm">✓</span>}
              </button>

              {/* טקסט המשימה */}
              <div className="flex-1">
                {readOnly ? (
                  <span
                    className={
                      item.completed
                        ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                        : 'text-ink-light dark:text-ink-dark'
                    }
                  >
                    {item.text}
                  </span>
                ) : (
                  <input
                    ref={(el) => {
                      inputRefs.current[item.id] = el;
                    }}
                    type="text"
                    value={item.text}
                    onChange={(e) => handleUpdateText(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                    placeholder="הזן משימה..."
                    className={`w-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-brand/40 rounded ${
                      item.completed
                        ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                        : 'text-ink-light dark:text-ink-dark'
                    }`}
                  />
                )}
              </div>

              {/* תאריך */}
              {readOnly
                ? item.dueDate && (
                    <span className={`flex-shrink-0 text-sm ${dateColor}`} title={dueLabel}>
                      📅
                    </span>
                  )
                : (
                  <DuePicker
                    inputId={`date-${item.id}`}
                    type="date"
                    value={item.dueDate || ''}
                    Icon={CalendarDays}
                    colorClass={dateColor}
                    title={dueLabel}
                    onChange={(next) => handleUpdateDueDate(item.id, next)}
                    onClear={() => handleClearDue(item.id)}
                  />
                )}

              {/* שעה - רלוונטית רק כשיש תאריך, והיא זו שמפעילה תזכורת */}
              {!readOnly && item.dueDate && (
                <DuePicker
                  inputId={`time-${item.id}`}
                  type="time"
                  value={item.dueTime || ''}
                  Icon={Clock}
                  colorClass={item.dueTime ? 'text-brand-text' : 'text-ink-3-light dark:text-ink-3-dark'}
                  title={item.dueTime ? `שעה: ${item.dueTime}` : 'הוסף שעה'}
                  onChange={(next) => handleUpdateDueTime(item.id, next)}
                  // הסרת השעה מסירה גם את החזרה: בלי שעה אין תזכורת,
                  // וכלל חזרה שנשאר היה חוזר בשקט אם תוסיף שעה שוב
                  onClear={() =>
                    updateItem(item.id, { dueTime: undefined, repeat: undefined, repeatBase: undefined })
                  }
                />
              )}

              {/* עדיפות: דגל בצבע הרמה, ותפריט קצר לבחירה. גם בצפייה, כמו הסימון */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPriorityMenuFor((open) => (open === item.id ? null : item.id))}
                  aria-haspopup="menu"
                  aria-expanded={priorityMenuFor === item.id}
                  title={`עדיפות: ${PRIORITY_META[levelOf(item)].label}`}
                  className="flex items-center"
                >
                  <PriorityFlag level={levelOf(item)} />
                </button>
                {priorityMenuFor === item.id && (
                  <>
                    {/* לחיצה מחוץ לתפריט סוגרת אותו */}
                    <div className="fixed inset-0 z-30" onClick={() => setPriorityMenuFor(null)} />
                    <div
                      role="menu"
                      className="absolute end-0 top-full mt-1 z-40 min-w-[7rem] py-1 rounded-lg shadow-lg bg-surface-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark"
                    >
                      {PRIORITY_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          role="menuitemradio"
                          aria-checked={levelOf(item) === level}
                          onClick={() => handleSetPriority(item.id, level)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-light dark:text-ink-dark hover:bg-raised-light dark:hover:bg-surface-dark ${
                            levelOf(item) === level ? 'font-semibold' : ''
                          }`}
                        >
                          <PriorityFlag level={level} size={16} />
                          {PRIORITY_META[level].label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* כפתור מחיקה */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="flex-shrink-0 text-danger dark:text-danger-dark hover:opacity-80 text-lg"
                  title="מחק משימה"
                >
                  <Trash2 size={18} strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* חזרה תקופתית - שורה שנייה, ורק כשיש תאריך ושעה.
                בלי שעה אין תזכורת שתחזור, ודחיסת בורר רביעי לשורה
                הראשונה הייתה מוציאה אותה מהמסך בנייד. */}
            {!readOnly && item.dueDate && item.dueTime && (
              <div className="flex items-center gap-2 ps-[4.5rem]">
                <Repeat
                  size={14}
                  strokeWidth={1.75}
                  className={
                    item.repeat
                      ? 'text-brand-text dark:text-brand-text-dark flex-shrink-0'
                      : 'text-ink-3-light dark:text-ink-3-dark flex-shrink-0'
                  }
                />
                <select
                  value={item.repeat || ''}
                  onChange={(e) => handleUpdateRepeat(item.id, e.target.value)}
                  className="text-caption bg-transparent text-ink-2-light dark:text-ink-2-dark border-0 focus:outline-none focus:ring-1 focus:ring-brand/40 rounded cursor-pointer"
                  title="חזרה תקופתית"
                >
                  <option value="">פעם אחת</option>
                  {(Object.keys(REPEAT_LABELS) as RepeatRule[]).map((rule) => (
                    <option key={rule} value={rule}>
                      {REPEAT_LABELS[rule]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </SortableRow>
    );
  };

  if (!parsed.ok) {
    return (
      <UnparseableContent templateType="checklist" value={value} onConvertToText={onConvertToText} />
    );
  }

  return (
    <div className="space-y-3">
      {/* התקדמות */}
      {totalCount > 0 && (
        <div className="bg-brand-soft dark:bg-brand-soft-dark p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-light dark:text-ink-dark">התקדמות:</span>
            <span className="text-sm font-bold text-brand-text dark:text-brand-text-dark">
              {completedCount} / {totalCount} ({Math.round(completedPercent)}%)
            </span>
          </div>
          <div className="w-full bg-hairline-light dark:bg-hairline-dark rounded-full h-2">
            <div
              className="bg-brand h-2 rounded-full transition-all duration-300"
              style={{ width: `${completedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* עדיפות: מיון וסינון. רק כשלמשימה כלשהי יש עדיפות */}
      {hasPriorities && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSortByPriority}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-caption border border-hairline-light dark:border-hairline-dark text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
            title="מסדר את המשימות לפי עדיפות ושומר את הסדר. אחר כך אפשר לגרור כרגיל"
          >
            <ArrowDownWideNarrow size={14} strokeWidth={1.75} />
            מיין לפי עדיפות
          </button>
          <span className="w-px h-4 bg-hairline-light dark:bg-hairline-dark" />
          {[null, ...PRIORITY_LEVELS].map((level) => (
            <button
              key={level ?? 'all'}
              type="button"
              onClick={() => setLevelFilter(level)}
              aria-pressed={filter === level}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-caption border transition-colors ${
                filter === level
                  ? 'bg-brand-soft dark:bg-brand-soft-dark border-brand text-brand-text dark:text-brand-text-dark'
                  : 'border-hairline-light dark:border-hairline-dark text-ink-2-light dark:text-ink-2-dark'
              }`}
            >
              {level && <PriorityFlag level={level} size={12} />}
              {level ? PRIORITY_META[level].label : 'הכל'}
            </button>
          ))}
        </div>
      )}

      {/* רשימת משימות */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center p-8 text-ink-3-light dark:text-ink-3-dark bg-raised-light dark:bg-raised-dark rounded-lg">
            אין משימות עדיין
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            accessibility={DRAG_ACCESSIBILITY}
          >
            {filter && shownItems.length === 0 && (
              <div className="text-center p-4 text-sm text-ink-3-light dark:text-ink-3-dark">
                אין משימות בעדיפות {PRIORITY_META[filter].label}
              </div>
            )}
            {/* שתי קבוצות נפרדות: גוררים בתוך הפתוחות או בתוך אלה שבוצעו */}
            <SortableContext items={openItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              {openItems.map(renderItem)}
            </SortableContext>
            {doneItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDone((open) => !open)}
                aria-expanded={showDone}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
              >
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  className={`flex-shrink-0 transition-transform ${showDone ? '' : 'rotate-90'}`}
                />
                בוצעו ({doneItems.length})
              </button>
            )}
            {showDone && (
              <SortableContext items={doneItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {doneItems.map(renderItem)}
              </SortableContext>
            )}
          </DndContext>
        )}
      </div>

      {/* משוב על הרשאת התראות - מוצג רק כשמשהו חוסם תזכורת */}
      {!readOnly && notificationWarning && (
        <p className="text-xs text-amber-700 dark:text-amber-400">⚠️ {notificationWarning}</p>
      )}

      {/* כפתור הוספת משימה */}
      {!readOnly && (
        <Button type="button" onClick={handleAddItem} size="sm" variant="outline" className="w-full">
          + הוסף משימה
        </Button>
      )}
    </div>
  );
};
