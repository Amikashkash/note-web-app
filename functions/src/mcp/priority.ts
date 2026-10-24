/**
 * עדיפות של משימה (שלב 3 בסבב 1). Claude שולח `urgent`, `normal` או `low`;
 * נשמרים רק `urgent` ו-`low` - רגילה היא היעדר השדה, כמו באפליקציה
 * (`TaskPriority` ב-`src/types/template.ts`).
 */

export const PRIORITY_INPUTS = ['urgent', 'normal', 'low'] as const;
export type PriorityInput = (typeof PRIORITY_INPUTS)[number];

/** הערך לשמירה. `undefined` - בלי השדה (רגילה) */
export const storedPriority = (priority: PriorityInput | null | undefined): 'urgent' | 'low' | undefined =>
  priority === 'urgent' || priority === 'low' ? priority : undefined;

export const PRIORITY_HEBREW: Record<PriorityInput, string> = { urgent: 'דחוף', normal: 'רגיל', low: 'נמוך' };
