/**
 * שגיאות הדומיין של notesCore.
 *
 * השכבה שמעל (MCP ב-שלב 1ג) ממפה אותן להודעות. notesCore לא יודע מה
 * המשתמש יראה, רק מה קרה.
 */

/**
 * "אין כאן כלום" - אותה שגיאה בדיוק כשהמסמך לא קיים, כשהוא של משתמש
 * אחר וכשהוא רגיש (mcp-plan §3.2.4, §3.4). בלי מזהה, בלי סיבה: כל פרט
 * שמבדיל בין המקרים מאפשר לגלות שיש שם משהו.
 */
export class NotFoundError extends Error {
  readonly code = 'not-found';
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

/**
 * הפתק נגיש למשתמש, אבל הפעולה לא (למשל שותף שמנסה לארכב).
 * לא חושף כלום: המשתמש כבר רואה את הפתק.
 */
export class ForbiddenError extends Error {
  readonly code = 'forbidden';
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** קלט שלא עבר ולידציה (שדה לא מותר, טיפוס שגוי, אורך חורג) */
export class InvalidError extends Error {
  readonly code = 'invalid';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidError';
  }
}
