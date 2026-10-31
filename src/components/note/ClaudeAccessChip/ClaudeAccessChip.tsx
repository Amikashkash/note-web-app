/**
 * הגישה של Claude לפתק (סבב 3, v1.42.0): צ'יפ קטן בראש הפתק שמציג את המצב
 * בפועל, ונפתח לתפריט עם שלוש אפשרויות. אף פעם לא מחזור בלחיצה אחת: לחיצה
 * בטעות לא חושפת פתק מוסתר.
 *
 * - רק הבעלים משנה (ה-rules דוחים את הדגלים משותף). מי ששותף איתו רואה את
 *   המצב, והתפריט אומר לו שרק הבעלים משנה.
 * - קטגוריה מחמירה (רגישה / קריאה בלבד) קובעת את המצב בפועל, והצ'יפ אומר
 *   שזה מהקטגוריה. הבחירה בתפריט היא של הפתק עצמו, וחלה גם אם יועבר.
 * - מעבר ממוסתר לגלוי מבקש אישור.
 * - קטגוריה לא ידועה (פתק ששותף איתך מקטגוריה של מישהו אחר - ה-rules לא
 *   נותנים לקרוא אותה, והשרת מחיל את הדגלים שלה): הצ'יפ לא טוען שהפתק פתוח,
 *   אלא אומר שזה תלוי בקטגוריה.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, HelpCircle, Lock, PenOff, Sparkles, type LucideIcon } from 'lucide-react';
import { accessOf, choiceExposes, effectiveAccess, flagsFor, type ClaudeAccess } from '@/utils/claudeAccess';

interface Flags {
  isSensitive: boolean;
  isReadOnly: boolean;
}

interface ClaudeAccessChipProps {
  note: Flags;
  /** `undefined` - הקטגוריה לא ידועה באפליקציה (ראה למעלה) */
  category?: Flags & { name: string };
  /** רק הבעלים משנה */
  canChange: boolean;
  onChange: (flags: { isSensitive: boolean; isReadOnly: boolean }) => void;
}

const META: Record<ClaudeAccess, { chip: string; option: string; detail: string; Icon: LucideIcon; tone: string }> = {
  edit: {
    chip: 'Claude: קורא ועורך',
    option: 'Claude קורא ועורך',
    detail: 'Claude רואה את הפתק ויכול לשנות אותו',
    Icon: Sparkles,
    tone: 'bg-success/10 text-success dark:text-success-dark border-success/30',
  },
  read: {
    chip: 'Claude: קריאה בלבד',
    option: 'קריאה בלבד ל-Claude',
    detail: 'Claude רואה את הפתק, ולא משנה אותו',
    Icon: PenOff,
    tone: 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800',
  },
  hidden: {
    chip: 'מוסתר מ-Claude',
    option: 'מוסתר מ-Claude',
    detail: 'Claude לא רואה את הפתק בכלל',
    Icon: Lock,
    tone: 'bg-danger-soft dark:bg-danger-soft-dark text-danger dark:text-danger-dark border-danger/30',
  },
};

const ORDER: ClaudeAccess[] = ['edit', 'read', 'hidden'];

export const ClaudeAccessChip: React.FC<ClaudeAccessChipProps> = ({ note, category, canChange, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { access, fromCategory } = effectiveAccess(note, category);
  const own = accessOf(note);
  // פתק מוסתר מוסתר בכל קטגוריה. אחרת, בלי הקטגוריה אי אפשר לדעת
  const unknown = !category && own !== 'hidden';
  const meta = unknown
    ? {
        chip: 'Claude: לפי הקטגוריה',
        Icon: HelpCircle,
        tone: 'bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark border-hairline-light dark:border-hairline-dark',
      }
    : META[access];

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // לא סוגר את הפתק כולו, רק את התפריט
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  const choose = (next: ClaudeAccess) => {
    setOpen(false);
    if (next === own) return;
    if (
      choiceExposes(note, category, next) &&
      !window.confirm(
        'הפתק מוסתר מ-Claude עכשיו. אחרי השינוי Claude יוכל לראות אותו' +
          (next === 'edit' ? ' ולשנות אותו' : '') +
          '.\n\nלהמשיך?'
      )
    ) {
      return;
    }
    onChange(flagsFor(next));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-body-sm font-medium transition-colors ${meta.tone}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="מה Claude יכול לעשות בפתק"
      >
        <meta.Icon size={16} strokeWidth={2} />
        <span>{meta.chip}</span>
        {fromCategory && <span className="opacity-80">· מהקטגוריה</span>}
        <ChevronDown size={14} strokeWidth={2} className="opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="הגישה של Claude לפתק"
          className="absolute start-0 top-11 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark shadow-e3 p-1.5"
        >
          {fromCategory && category && (
            <p className="px-3 pt-2 pb-2 text-body-sm text-ink-2-light dark:text-ink-2-dark">
              {access === 'hidden'
                ? `הקטגוריה "${category.name}" מוסתרת מ-Claude, ולכן גם הפתק - בכל בחירה כאן.`
                : `הקטגוריה "${category.name}" לקריאה בלבד ל-Claude, ולכן גם הפתק.`}{' '}
              הבחירה כאן היא של הפתק עצמו, ותחול אם יועבר לקטגוריה אחרת.
            </p>
          )}
          {unknown && (
            <p className="px-3 pt-2 pb-2 text-body-sm text-ink-2-light dark:text-ink-2-dark">
              הפתק בקטגוריה שאינה מוצגת אצלך, וההגדרה שלה עשויה להגביל את Claude יותר. למטה - ההגדרה של הפתק עצמו.
            </p>
          )}
          {!canChange && (
            <p className="px-3 pt-2 pb-2 text-body-sm text-ink-2-light dark:text-ink-2-dark">
              רק הבעלים של הפתק יכול לשנות את זה.
            </p>
          )}
          {ORDER.map((level) => {
            const option = META[level];
            const selected = level === own;
            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={!canChange}
                onClick={() => choose(level)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-start hover:bg-raised-light dark:hover:bg-raised-dark disabled:opacity-60 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <option.Icon size={18} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-ink-2-light dark:text-ink-2-dark" />
                <span className="flex-1 min-w-0">
                  <span className="block text-body font-medium text-ink-light dark:text-ink-dark">{option.option}</span>
                  <span className="block text-body-sm text-ink-3-light dark:text-ink-3-dark">{option.detail}</span>
                </span>
                {selected && <Check size={18} strokeWidth={2.25} className="mt-0.5 flex-shrink-0 text-brand dark:text-brand-dark" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
