/**
 * תאריכים ושעות של משימות: שעון ישראל, כמו באפליקציה. משותף ל-`create_note`
 * ול-`update_checklist_item`, כדי ששניהם יקבלו ויסרבו לאותם ערכים.
 */

import { InvalidError } from '../notesCore/errors';
import { isRepeatRule, nextOccurrence } from '../recurrence';
import { localDateTimeToDate } from '../timezone';

/** תאריך יעד רחוק מזה הוא כמעט תמיד טעות (שנה שגויה) */
export const MAX_YEARS_AHEAD = 5;

/** תאריך אמיתי בלוח השנה, לא רק בצורה הנכונה (2026-02-30 נדחה) */
export const isCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isClockTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export interface Timing {
  dueDate?: string;
  dueTime?: string;
  repeat?: string;
}

/**
 * בודק תאריך, שעה וחזרה של משימה, ומחזיר את מועד התזכורת הראשון (אם יש
 * שעה), או `null`. `label` - "item 2" וכו', להודעות.
 *
 * `requireFuture`: שעה שכבר עברה נדחית (לא תישלח תזכורת). כבוי כשרק
 * מסמנים משימה כבוצעה - אז המועד לא משנה.
 */
export const validateTiming = (timing: Timing, label: string, now: Date, requireFuture = true): Date | null => {
  const { dueDate, dueTime, repeat } = timing;
  if (dueDate === undefined && dueTime === undefined && repeat === undefined) return null;

  if (dueDate !== undefined && !isCalendarDate(dueDate)) {
    throw new InvalidError(`${label}: dueDate "${dueDate}" is not a valid date. Use YYYY-MM-DD, for example 2026-10-05`);
  }
  if (dueTime !== undefined && !isClockTime(dueTime)) {
    throw new InvalidError(`${label}: dueTime "${dueTime}" is not a valid time. Use 24-hour HH:MM, for example 09:30`);
  }
  if (dueTime !== undefined && dueDate === undefined) {
    throw new InvalidError(`${label}: dueTime needs a dueDate. Add the date, or leave out the time`);
  }
  if (repeat !== undefined && !isRepeatRule(repeat)) {
    throw new InvalidError(`${label}: repeat must be one of daily, weekly, monthly, yearly`);
  }
  if (repeat !== undefined && (dueDate === undefined || dueTime === undefined)) {
    throw new InvalidError(`${label}: repeat needs both dueDate and dueTime (the first occurrence)`);
  }

  const date = dueDate as string;
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + MAX_YEARS_AHEAD);
  if (Date.parse(`${date}T00:00:00Z`) > limit.getTime()) {
    throw new InvalidError(`${label}: dueDate ${date} is more than ${MAX_YEARS_AHEAD} years ahead. Check the year`);
  }

  // תאריך בלי שעה: יעד בתצוגה בלבד, בלי תזכורת (כמו באפליקציה)
  if (dueTime === undefined) return null;

  const firstAt = isRepeatRule(repeat) ? nextOccurrence(date, dueTime, repeat, now) : localDateTimeToDate(date, dueTime);
  if (!firstAt) throw new InvalidError(`${label}: could not read ${date} ${dueTime}`);
  if (requireFuture && firstAt.getTime() <= now.getTime()) {
    throw new InvalidError(
      `${label}: ${date} ${dueTime} Israel time has already passed, so no reminder would be sent. ` +
        'Ask the user for a future time, or leave out dueTime to keep only the date'
    );
  }
  return firstAt;
};
