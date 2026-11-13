/**
 * גיליון של סעיף אחד בתכנית עבודה (v1.44.0). נפתח בנגיעה בשורה המקופלת.
 *
 * - למעלה: סגירה, מעבר לסעיף הקודם / הבא בלי לסגור, ותפריט "⋮" קטן (עיצוב
 *   והסרת הסעיף - אף פעם לא כפתור אדום).
 * - "מצב ותובנות": המצב הקבוע של הסעיף, ראשון.
 * - היומן, עם "+ רשומה היום" שמוסיף שורה עם התאריך ומציב את הסמן אחריו.
 * - השדות גדלים לפי הטקסט: אין חלון גלילה קטן בתוך הגיליון.
 *
 * כל שינוי עובר ל-`onPatch`, וממנו ל-`onChange` של התבנית - אותה שמירה
 * אוטומטית, שורת מצב וסימון "מקליד עכשיו" של שאר הפתק.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bold, ChevronLeft, ChevronRight, ClipboardPaste, Italic, MoreVertical, Plus, Trash2, X, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { AutoGrowTextarea } from '@/components/common/AutoGrowTextarea/AutoGrowTextarea';
import { EnhancedTextarea, type EnhancedTextareaHandle } from '@/components/common/EnhancedTextarea';
import { FormattedText } from '@/components/common/FormattedText';
import { NoteLinks } from '@/components/note/NoteLinks/NoteLinks';
import type { SectionStatus, WorkPlanSection } from '@/types/template';
import { appendTodayEntry, STATUS_LABELS, STATUS_TONE, timeAgo, type SectionPatch } from '@/utils/workplan';

interface WorkPlanSectionSheetProps {
  sections: WorkPlanSection[];
  index: number;
  readOnly: boolean;
  statusEnabled: boolean;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onPatch: (id: string, patch: SectionPatch) => void;
  onRemove: (id: string) => void;
}

const STATUSES: SectionStatus[] = ['open', 'active', 'done'];

const iconButton =
  'h-11 w-11 grid place-items-center rounded-xl text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

const MenuItem: React.FC<{ icon: LucideIcon; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
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

export const WorkPlanSectionSheet: React.FC<WorkPlanSectionSheetProps> = ({
  sections,
  index,
  readOnly,
  statusEnabled,
  onNavigate,
  onClose,
  onPatch,
  onRemove,
}) => {
  const section = sections[index];
  const [menuOpen, setMenuOpen] = useState(false);
  // "לפני כמה זמן" - מרגע הפתיחה; לא שעון שמתקתק בזמן שהגיליון פתוח
  const [openedAt] = useState(() => Date.now());
  // העיצוב בתפריט חל על השדה האחרון שהיה בו פוקוס (ברירת מחדל: היומן)
  const lastField = useRef<'state' | 'log'>('log');
  const stateRef = useRef<EnhancedTextareaHandle>(null);
  const logRef = useRef<EnhancedTextareaHandle>(null);
  const pendingCursor = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // אחרי "+ רשומה היום": הסמן אחרי התאריך, כשהטקסט החדש כבר בשדה
  useEffect(() => {
    if (pendingCursor.current === null) return;
    logRef.current?.focusAt(pendingCursor.current);
    pendingCursor.current = null;
  });

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

  if (!section) return null;

  const patch = (change: SectionPatch) => onPatch(section.id, change);
  const field = () => (lastField.current === 'state' ? stateRef : logRef).current;

  const addToday = () => {
    const entry = appendTodayEntry(section.content, new Date());
    pendingCursor.current = entry.cursor;
    patch({ content: entry.log });
  };

  const remove = () => {
    setMenuOpen(false);
    const name = section.header.trim() || 'ללא כותרת';
    if (window.confirm(`להסיר את הסעיף "${name}"?\n\nאפשר לשחזר אותו מהיסטוריית הפתק.`)) onRemove(section.id);
  };

  const format = (action: 'bold' | 'italic' | 'paste') => {
    setMenuOpen(false);
    void field()?.[action]();
  };

  const status = section.status ?? 'open';

  return (
    <Modal onClose={onClose}>
      <div className="sm:w-[36rem] -mt-2">
        {/* פס עליון: סגירה, קודם / הבא, תפריט. דביק בתוך הגיליון */}
        <div className="sticky -top-4 sm:-top-6 z-20 -mx-4 sm:-mx-6 px-2 py-1 flex items-center gap-1 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur border-b border-hairline-light dark:border-hairline-dark">
          <button type="button" onClick={onClose} className={iconButton} aria-label="סגור את הסעיף">
            <X size={22} strokeWidth={2} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1">
            {/* ב-RTL "הקודם" הוא בצד ימין, והחץ מצביע ימינה */}
            <button
              type="button"
              onClick={() => onNavigate(index - 1)}
              disabled={index === 0}
              className={iconButton}
              aria-label="הסעיף הקודם"
            >
              <ChevronRight size={24} strokeWidth={2} />
            </button>
            <span className="text-body-sm text-ink-3-light dark:text-ink-3-dark tabular-nums min-w-[4.5rem] text-center">
              {index + 1} מתוך {sections.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              disabled={index === sections.length - 1}
              className={iconButton}
              aria-label="הסעיף הבא"
            >
              <ChevronLeft size={24} strokeWidth={2} />
            </button>
          </div>
          {!readOnly ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className={iconButton}
                aria-label="עוד פעולות לסעיף"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={20} strokeWidth={2} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute end-0 top-12 z-30 w-52 py-1 rounded-xl bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark shadow-e3"
                >
                  <MenuItem icon={Bold} label="מודגש" onClick={() => format('bold')} />
                  <MenuItem icon={Italic} label="נטוי" onClick={() => format('italic')} />
                  <MenuItem icon={ClipboardPaste} label="הדבקה" onClick={() => format('paste')} />
                  <div className="my-1 border-t border-hairline-light dark:border-hairline-dark" />
                  <MenuItem icon={Trash2} label="הסרת הסעיף" onClick={remove} />
                </div>
              )}
            </div>
          ) : (
            <span className="w-11" aria-hidden="true" />
          )}
        </div>

        <div key={section.id} className="space-y-5 pt-4">
          {/* כותרת */}
          {readOnly ? (
            <h3 className="text-h1 text-ink-light dark:text-ink-dark">{section.header || 'ללא כותרת'}</h3>
          ) : (
            <AutoGrowTextarea
              value={section.header}
              onChange={(header) => patch({ header })}
              placeholder="שם הסעיף"
              aria-label="שם הסעיף"
              className="w-full px-1 py-1 text-h1 text-ink-light dark:text-ink-dark bg-transparent border-0 rounded focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          )}

          {statusEnabled && (
            <div role="radiogroup" aria-label="סטטוס הסעיף" className="flex gap-2">
              {STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={status === value}
                  disabled={readOnly}
                  onClick={() => patch({ status: value })}
                  className={`h-10 px-4 rounded-full border text-body-sm font-medium transition-colors ${
                    status === value
                      ? STATUS_TONE[value]
                      : 'border-hairline-light dark:border-hairline-dark text-ink-3-light dark:text-ink-3-dark hover:bg-raised-light dark:hover:bg-raised-dark'
                  }`}
                >
                  {STATUS_LABELS[value]}
                </button>
              ))}
            </div>
          )}

          {/* מצב ותובנות - ראשון, ברקע משלו */}
          <section className="rounded-xl bg-brand-soft/60 dark:bg-brand-soft-dark/40 border border-brand-soft-bd dark:border-brand-soft-bd-dark p-3 space-y-2">
            <h4 className="text-body font-semibold text-ink-light dark:text-ink-dark">מצב ותובנות</h4>
            {readOnly ? (
              <FormattedText content={section.state || 'ריק'} />
            ) : (
              <EnhancedTextarea
                ref={stateRef}
                value={section.state ?? ''}
                onChange={(state) => patch({ state })}
                onFocus={() => {
                  lastField.current = 'state';
                }}
                aria-label="מצב ותובנות"
                placeholder="למשל: 2 זכרים, 5 נקבות"
                rows={2}
                toolbar={false}
                hints={false}
                autoGrow
                className="text-body"
              />
            )}
            <NoteLinks text={section.state ?? ''} />
          </section>

          {/* היומן */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-body font-semibold text-ink-light dark:text-ink-dark">יומן</h4>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addToday}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-body-sm font-medium text-brand-text dark:text-brand-text-dark hover:bg-brand-soft dark:hover:bg-brand-soft-dark transition-colors"
                >
                  <Plus size={16} strokeWidth={2} />
                  רשומה היום
                </button>
              )}
            </div>
            {readOnly ? (
              <FormattedText content={section.content || 'אין רשומות'} />
            ) : (
              <EnhancedTextarea
                ref={logRef}
                value={section.content}
                onChange={(content) => patch({ content })}
                onFocus={() => {
                  lastField.current = 'log';
                }}
                aria-label="יומן"
                placeholder="13/11 מה קרה היום..."
                rows={4}
                toolbar={false}
                hints={false}
                autoGrow
                className="text-body"
              />
            )}
            <NoteLinks text={section.content} />
          </section>

          {section.updatedAt && (
            <p className="text-body-sm text-ink-3-light dark:text-ink-3-dark pb-1">
              הסעיף עודכן {timeAgo(section.updatedAt, openedAt)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
