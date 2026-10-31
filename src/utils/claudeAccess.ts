/**
 * הגישה של Claude לפתק, כרמה אחת מתוך שתי הדגלים (סבב 3, v1.42.0):
 *
 * - `edit` - קורא ועורך (שני הדגלים כבויים)
 * - `read` - קריאה בלבד (`isReadOnly`)
 * - `hidden` - מוסתר (`isSensitive`), גובר על קריאה בלבד
 *
 * הקטגוריה יכולה להחמיר, לא להקל: המצב בפועל הוא המחמיר מבין הפתק והקטגוריה
 * (כך גם בשרת - `notesCore`). הצ'יפ בפתק מציג את המצב בפועל, ואומר כשהוא
 * בא מהקטגוריה, במקום להעמיד פנים שהפתק פתוח.
 */

export type ClaudeAccess = 'edit' | 'read' | 'hidden';

interface Flags {
  isSensitive?: boolean;
  isReadOnly?: boolean;
}

const RANK: Record<ClaudeAccess, number> = { edit: 0, read: 1, hidden: 2 };

/** הרמה שנקבעה על הפתק (או הקטגוריה) עצמו */
export const accessOf = (flags: Flags): ClaudeAccess =>
  flags.isSensitive ? 'hidden' : flags.isReadOnly ? 'read' : 'edit';

/** הדגלים שכותבים לפתק כדי לקבוע לו רמה */
export const flagsFor = (access: ClaudeAccess): { isSensitive: boolean; isReadOnly: boolean } => ({
  isSensitive: access === 'hidden',
  isReadOnly: access === 'read',
});

/**
 * המצב בפועל. `fromCategory` - הקטגוריה מחמירה יותר מהפתק, ולכן היא שקובעת.
 */
export const effectiveAccess = (
  note: Flags,
  category?: Flags
): { access: ClaudeAccess; fromCategory: boolean } => {
  const own = accessOf(note);
  const inherited = category ? accessOf(category) : 'edit';
  return RANK[inherited] > RANK[own]
    ? { access: inherited, fromCategory: true }
    : { access: own, fromCategory: false };
};

/**
 * האם בחירת `next` חושפת ל-Claude פתק שמוסתר ממנו עכשיו. אם הקטגוריה מוסתרת,
 * הפתק נשאר מוסתר בכל בחירה - ואין מה לאשר.
 */
export const choiceExposes = (note: Flags, category: Flags | undefined, next: ClaudeAccess): boolean =>
  effectiveAccess(note, category).access === 'hidden' &&
  effectiveAccess(flagsFor(next), category).access !== 'hidden';
