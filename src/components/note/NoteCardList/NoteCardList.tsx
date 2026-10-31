/**
 * פתקי קטגוריה ככרטיסי נייר ברוחב מלא, אחד בשורה, גלילה אנכית בלבד
 * (סבב 3, v1.41.0). משמש גם בקטגוריה הפתוחה במסך הבית וגם בדף הקטגוריה.
 *
 * - לחיצה בכל מקום בכרטיס פותחת את הפתק. אין "הצג" ואין "מחק".
 * - "⋮" קטן: נעיצה, ו"העבר לארכיון" (לא "מחק" - הפתק נשמר ואפשר להחזיר).
 *   בפתק של מישהו אחר: "הסר אותי" במקום הארכיון (v1.42.0) - ארכוב פתק של
 *   מישהו אחר הוא לא ההחלטה שלך, כמו בתוך הפתק.
 * - גרירה לשינוי הסדר כמו בקטגוריות: במגע רק בלחיצה ארוכה, כך שגלילה לא
 *   מזיזה כרטיס. נעוצים ולא-נעוצים הם שתי קבוצות: גוררים בתוך קבוצה.
 * - סימנים רק למצב אמיתי: נעוץ, רגיש, קריאה בלבד ל-Claude, משותף, נוצר
 *   ע"י Claude, והתקדמות ברשימה.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Archive, Lock, LogOut, MoreVertical, PenOff, Pin, PinOff, Sparkles, Users } from 'lucide-react';
import type { Note } from '@/types/note';
import { useAuthStore } from '@/store/authStore';
import { byPinnedThenOrder } from '@/services/api/mappers';
import { cardPreview, listProgress } from '@/utils/noteCard';

interface NoteCardListProps {
  notes: Note[];
  /** צבע הפס כשלפתק אין צבע משלו */
  categoryColor: string;
  onOpen: (note: Note) => void;
  /** רק לפתקים שלי */
  onArchive?: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  /** פתק של מישהו אחר: הסרה של עצמי מהשיתוף (עם אישור, אצל הקורא) */
  onLeave?: (note: Note) => void;
  /** הסדר החדש של כל הפתקים בקטגוריה. בלי זה (למשל בחיפוש) אין גרירה */
  onReorder?: (orderedIds: string[]) => void;
  /** טקסט כשאין פתקים */
  emptyText: string;
}

/** הודעות לקורא מסך, בעברית (ברירת המחדל של הספרייה באנגלית) */
const DRAG_ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable: 'כדי להזיז פתק: רווח כדי להרים, חיצים כדי להזיז, רווח כדי להניח, Escape כדי לבטל. Enter פותח.',
  },
  announcements: {
    onDragStart: () => 'הפתק הורם',
    onDragOver: () => 'הפתק הוזז',
    onDragEnd: () => 'הפתק הונח',
    onDragCancel: () => 'ההזזה בוטלה',
  },
};

/** אחרי גרירה בעכבר הדפדפן שולח click לכרטיס. הוא לא אמור לפתוח את הפתק */
const CLICK_AFTER_DRAG_MS = 300;

/** הזזה בתוך קבוצה. `null` - אין שינוי, או מעבר בין נעוצים ללא-נעוצים */
const moveWithin = (groups: string[][], activeId: string, overId: string): string[] | null => {
  const group = groups.find((ids) => ids.includes(activeId));
  if (!group || !group.includes(overId) || activeId === overId) return null;
  const next = [...group];
  next.splice(next.indexOf(activeId), 1);
  next.splice(group.indexOf(overId), 0, activeId);
  return groups.flatMap((ids) => (ids === group ? next : ids));
};

export const NoteCardList: React.FC<NoteCardListProps> = ({
  notes,
  categoryColor,
  onOpen,
  onArchive,
  onTogglePin,
  onLeave,
  onReorder,
  emptyText,
}) => {
  const userId = useAuthStore((state) => state.user?.uid);
  const ignoreClicks = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // מגע: לחיצה ארוכה, כמו במשימות ובקטגוריות. גלילה לא מזיזה כרטיס
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // רק רווח מרים. Enter נשאר לפתיחת הפתק
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const sorted = useMemo(() => [...notes].sort(byPinnedThenOrder), [notes]);
  const pinned = sorted.filter((note) => note.isPinned);
  const unpinned = sorted.filter((note) => !note.isPinned);

  if (notes.length === 0) {
    return <p className="py-6 text-center text-body text-ink-3-light dark:text-ink-3-dark">{emptyText}</p>;
  }

  const endDrag = () => {
    window.setTimeout(() => {
      ignoreClicks.current = false;
    }, CLICK_AFTER_DRAG_MS);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag();
    if (!over || !onReorder) return;
    const next = moveWithin(
      [pinned.map((note) => note.id), unpinned.map((note) => note.id)],
      String(active.id),
      String(over.id)
    );
    if (next) onReorder(next);
  };

  const open = (note: Note) => {
    if (!ignoreClicks.current) onOpen(note);
  };

  const renderGroup = (group: Note[]) => (
    <SortableContext items={group.map((note) => note.id)} strategy={verticalListSortingStrategy}>
      {group.map((note) => (
        <PaperCard
          key={note.id}
          note={note}
          categoryColor={categoryColor}
          dragDisabled={!onReorder}
          isMine={userId !== undefined && note.userId === userId}
          onOpen={() => open(note)}
          onArchive={onArchive && (() => onArchive(note.id))}
          onTogglePin={onTogglePin && (() => onTogglePin(note.id, !note.isPinned))}
          onLeave={onLeave && (() => onLeave(note))}
        />
      ))}
    </SortableContext>
  );

  return (
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
      <div className="space-y-2.5">
        {renderGroup(pinned)}
        {renderGroup(unpinned)}
      </div>
    </DndContext>
  );
};

interface PaperCardProps {
  note: Note;
  categoryColor: string;
  dragDisabled: boolean;
  isMine: boolean;
  onOpen: () => void;
  onArchive?: () => void;
  onTogglePin?: () => void;
  onLeave?: () => void;
}

/** מונע מהלחיצה על "⋮" ועל התפריט להתחיל גרירה או לפתוח את הפתק */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

const statusIconClass = 'flex-shrink-0 text-ink-3-light dark:text-ink-3-dark';

const PaperCard: React.FC<PaperCardProps> = ({
  note,
  categoryColor,
  dragDisabled,
  isMine,
  onOpen,
  onArchive,
  onTogglePin,
  onLeave,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: dragDisabled,
  });
  // בלי גרירה (חיפוש, "שותף איתי") dnd-kit מסמן את הכרטיס `aria-disabled`, וקורא
  // מסך היה אומר "לא זמין" על כרטיס שנפתח בלחיצה. אז רק "כפתור" רגיל
  const cardAttributes = dragDisabled ? { role: 'button', tabIndex: 0 } : attributes;

  // סגירת התפריט בלחיצה מחוץ לו
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [menuOpen]);

  const progress = listProgress(note);
  const preview = cardPreview(note);
  const isShared = note.sharedWith.length > 0 || !isMine;
  // ארכוב רק לפתק שלי; בפתק של אחר - "הסר אותי"
  const archive = isMine ? onArchive : undefined;
  const leave = isMine ? undefined : onLeave;
  const hasMenu = Boolean(onTogglePin || archive || leave);

  const handleArchive = () => {
    setMenuOpen(false);
    if (archive && window.confirm(`להעביר את "${note.title || 'ללא כותרת'}" לארכיון?\n\nאפשר להחזיר אותו מהארכיון בכל זמן.`)) {
      archive();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...cardAttributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(event) => {
        // `listeners` כוללים onKeyDown של הגרירה (רווח). Enter פותח
        listeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen();
      }}
      aria-label={`פתח את ${note.title || 'הפתק'}`}
      style={{
        borderInlineStartColor: note.color || categoryColor,
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : menuOpen ? 10 : undefined,
      }}
      className={`paper-card relative rounded-xl rounded-se-none border-s-4 ps-4 pe-3 py-3 cursor-pointer touch-manipulation select-none [-webkit-touch-callout:none] transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
        isDragging ? 'shadow-e3 opacity-95' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {note.isPinned && (
              <Pin
                size={16}
                strokeWidth={2}
                fill="currentColor"
                className="flex-shrink-0 text-cat-orange dark:text-cat-orange-dark"
                aria-label="נעוץ"
              />
            )}
            <h3 className="text-body font-semibold text-ink-light dark:text-ink-dark truncate">
              {note.title || 'ללא כותרת'}
            </h3>
            {note.isSensitive && <Lock size={15} strokeWidth={2} className={statusIconClass} aria-label="רגיש - מוסתר מ-Claude" />}
            {note.isReadOnly && <PenOff size={15} strokeWidth={2} className={statusIconClass} aria-label="קריאה בלבד ל-Claude" />}
            {isShared && <Users size={15} strokeWidth={2} className={statusIconClass} aria-label="משותף" />}
            {note.createdVia === 'mcp' && (
              <Sparkles size={15} strokeWidth={2} className="flex-shrink-0 text-brand dark:text-brand-dark" aria-label="נוצר ע״י Claude" />
            )}
          </div>
          {preview && (
            <p className="mt-1 text-body-sm text-ink-2-light dark:text-ink-2-dark line-clamp-2 break-words">{preview}</p>
          )}
        </div>

        {progress && (
          <span
            className={`mt-0.5 flex-shrink-0 text-caption tabular-nums px-2 py-0.5 rounded-full border ${
              progress.done === progress.total
                ? 'bg-success/10 text-success dark:text-success-dark border-success/30'
                : 'bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark border-hairline-light dark:border-hairline-dark'
            }`}
            aria-label={`${progress.done} מתוך ${progress.total} בוצעו`}
          >
            {progress.done}/{progress.total}
          </span>
        )}

        {/* תפריט משני: נעיצה, "העבר לארכיון" (שלי) או "הסר אותי" (של אחר) */}
        {hasMenu && (
          <div
            className="relative flex-shrink-0 -me-1 -mt-1"
            ref={menuRef}
            onClick={stop}
            onMouseDown={stop}
            onTouchStart={stop}
            onKeyDown={stop}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="h-9 w-9 grid place-items-center rounded-lg text-ink-3-light dark:text-ink-3-dark hover:bg-raised-light dark:hover:bg-raised-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
              aria-label={`פעולות על ${note.title || 'הפתק'}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} strokeWidth={2} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute end-0 top-10 z-30 w-48 py-1 rounded-xl bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark shadow-e3"
              >
                {onTogglePin && (
                  <MenuItem
                    icon={note.isPinned ? PinOff : Pin}
                    label={note.isPinned ? 'ביטול נעיצה' : 'נעיצה למעלה'}
                    onClick={() => {
                      setMenuOpen(false);
                      onTogglePin();
                    }}
                  />
                )}
                {archive && <MenuItem icon={Archive} label="העבר לארכיון" onClick={handleArchive} />}
                {leave && (
                  <MenuItem
                    icon={LogOut}
                    label="הסר אותי"
                    onClick={() => {
                      setMenuOpen(false);
                      leave();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MenuItem: React.FC<{ icon: typeof Archive; label: string; onClick: () => void }> = ({
  icon: Icon,
  label,
  onClick,
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-body-sm text-ink-light dark:text-ink-dark hover:bg-raised-light dark:hover:bg-raised-dark text-start"
  >
    <Icon size={16} strokeWidth={1.75} />
    {label}
  </button>
);
