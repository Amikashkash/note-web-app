/**
 * "טיפים" בפתק (סבב 3, v1.42.0): כל ההסברים שהיו פזורים בגוף הפתק - ההסברים
 * הגדולים על הרשאות Claude, "פתוח גם במקום אחר", עיצוב טקסט, הנהלת חשבונות
 * ותכנית עבודה - מאחורי כפתור אחד עם נורה. התוכן נשמר כמו שהיה, רק מוסתר.
 *
 * נפתח בחלונית (`Modal`): בטלפון גיליון תחתון שנסגר ב-X, בנגיעה ברקע או
 * ב"חזור". מוצגים רק הטיפים שרלוונטיים לסוג הפתק.
 */

import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { TemplateType } from '@/types/note';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-h2 text-ink-light dark:text-ink-dark">{title}</h3>
    <ul className="space-y-2 text-body text-ink-2-light dark:text-ink-2-dark list-disc ps-5">{children}</ul>
  </section>
);

export const NoteTips: React.FC<{ templateType: TemplateType }> = ({ templateType }) => {
  const [open, setOpen] = useState(false);
  const hasTextTips = templateType === 'plain' || templateType === 'workplan';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-body-sm font-medium border border-hairline-light dark:border-hairline-dark text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
        aria-haspopup="dialog"
      >
        <Lightbulb size={16} strokeWidth={1.75} className="text-amber-500 dark:text-amber-400" />
        טיפים
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} title="טיפים">
          <div className="space-y-6 sm:min-w-[32rem] max-w-2xl pb-2">
            <Section title="Claude והפתק">
              <li>
                <strong>מוסתר מ-Claude:</strong> Claude לא יראה את הפתק הזה בכלל. מה שכבר נקרא בשיחה קודמת לא
                נמחק ממנה, וזו לא הצפנה - הפתק נשמר כרגיל.
              </li>
              <li>
                <strong>קריאה בלבד ל-Claude:</strong> Claude יכול לקרוא את הפתק אבל לא לשנות אותו. באפליקציה הוא
                נשאר ניתן לעריכה.
              </li>
              <li>
                כשהקטגוריה מסומנת כרגישה, הפתק מוסתר גם בלי סימון משלו. כשהקטגוריה לקריאה בלבד, גם הפתק לקריאה
                בלבד. ההגדרה שבראש הפתק אומרת כשהמצב בא מהקטגוריה.
              </li>
              <li>רק הבעלים של הפתק משנה את ההגדרה. מי ששותף איתו רואה אותה.</li>
              <li>Claude לא משנה פתק בזמן שמקלידים בו. כל שינוי שלו נשמר בהיסטוריה של הפתק.</li>
            </Section>

            <Section title="עבודה משותפת">
              <li>
                כשהפתק פתוח גם במקום אחר, שינויים של כל צד יופיעו אצל השני. אם שניכם תשנו את אותו מקום, תתבקשו
                לבחור איזו גרסה לשמור.
              </li>
            </Section>

            {hasTextTips && (
              <Section title="עיצוב טקסט">
                <li>מספור אוטומטי: התחל שורה עם "1. " ולחץ Enter</li>
                <li>נקודות: התחל שורה עם "* " ולחץ Enter</li>
                <li>הדגשה: סמן טקסט ולחץ על כפתור "מודגש"</li>
              </Section>
            )}

            {templateType === 'workplan' && (
              <Section title="תכנית עבודה">
                <li>לחץ על "הוסף סעיף" כדי להתחיל לבנות את תכנית העבודה.</li>
              </Section>
            )}

            {templateType === 'accounting' && (
              <Section title="הנהלת חשבונות - כיצד להשתמש">
                <li>סכום חיובי (+) = קיבלת כסף</li>
                <li>סכום שלילי (-) = שילמת כסף</li>
                <li>היתרה מחושבת אוטומטית</li>
                <li>שורות ישנות מוסתרות אוטומטית</li>
              </Section>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
