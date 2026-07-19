/**
 * עזרי טיפול בשגיאות
 *
 * המטרה: לא לאבד את השגיאה המקורית (למשל permission-denied מ-Firestore)
 * בזמן שמציגים למשתמש הודעה קריאה בעברית.
 */

/**
 * חילוץ הודעת שגיאה מכל ערך שנתפס ב-catch
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'שגיאה לא ידועה';
};

/**
 * עוטף שגיאה בהודעה ידידותית תוך שמירת השגיאה המקורית ב-`cause`.
 * כך המשתמש רואה טקסט בעברית, והמפתח רואה את הסיבה האמיתית בקונסול.
 */
export const wrapError = (message: string, cause: unknown): Error => {
  return new Error(message, { cause });
};

/**
 * קוד השגיאה של Firebase (למשל 'permission-denied', 'not-found'), אם קיים
 */
export const getFirebaseErrorCode = (error: unknown): string | null => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
};
