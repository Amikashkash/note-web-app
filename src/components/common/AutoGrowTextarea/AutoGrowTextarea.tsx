/**
 * שדה טקסט של שורה בתבנית (משימה, פריט, מרכיב...) שנשבר לשורות וגדל לפי
 * התוכן (v1.43.1).
 *
 * למה: מאז שאין מצב עריכה (v1.39.0) טקסט המשימה הוא תמיד שדה עריכה, ו-
 * `<input type="text">` הוא שורה אחת. בטלפון, אחרי אייקוני הדגל והתאריך,
 * נראו 4-5 מילים והשאר נחתך בלי דרך לקרוא אותו.
 *
 * - מתחיל בשורה אחת, גדל לגובה התוכן. בלי פס גלילה ובלי ידית הגדלה.
 * - **בלי ירידות שורה בתוך הפריט**: Enter לא מוסיף שורה (הוא קורא ל-`onEnter`,
 *   למשל "משימה חדשה"), ושורות בהדבקה הופכות לרווח. הערך נשאר שורה אחת,
 *   כמו ב-input - רק התצוגה נשברת.
 * - הגובה מחושב מחדש כשהערך משתנה וכשהרוחב משתנה (סיבוב מסך, פתיחת לוח).
 */

import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { singleLine } from '@/utils/singleLine';

type NativeProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'rows' | 'onKeyDown'
>;

interface AutoGrowTextareaProps extends NativeProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter (בלי Shift). בלי - Enter לא עושה כלום, כמו ב-input בלי טופס */
  onEnter?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  ({ value, onChange, onEnter, onKeyDown, className = '', style, ...rest }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (element: HTMLTextAreaElement | null) => {
        innerRef.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      [forwardedRef]
    );

    const fit = useCallback(() => {
      const element = innerRef.current;
      if (!element) return;
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }, []);

    // לפני הציור: בלי הבהוב של שורה אחת שקופצת לגובה המלא
    useLayoutEffect(fit, [value, fit]);

    // הרוחב קובע איפה הטקסט נשבר. רק שינוי רוחב - שינוי הגובה שלנו לא מפעיל שוב
    useEffect(() => {
      const element = innerRef.current;
      if (!element || typeof ResizeObserver === 'undefined') return;
      let width = element.clientWidth;
      const observer = new ResizeObserver(() => {
        if (element.clientWidth !== width) {
          width = element.clientWidth;
          fit();
        }
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [fit]);

    return (
      <textarea
        {...rest}
        ref={setRef}
        rows={1}
        value={value}
        onChange={(event) => onChange(singleLine(event.target.value))}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== 'Enter') return;
          // בזמן הרכבת תווים (IME) Enter מאשר את המילה, לא שולח
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!event.shiftKey) onEnter?.();
        }}
        className={`block resize-none overflow-hidden ${className}`}
        style={{ ...style, overflowWrap: 'anywhere' }}
      />
    );
  }
);

AutoGrowTextarea.displayName = 'AutoGrowTextarea';
