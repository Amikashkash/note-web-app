/**
 * האות שמוצגת באווטאר כשאין תמונה (התחברות באימייל וסיסמה, או תמונה שלא נטענה).
 * מהשם, ואם אין - מהאימייל. `null` - אין ממה, ומוצג אייקון משתמש כללי.
 */
export const avatarInitial = (displayName?: string | null, email?: string | null): string | null => {
  for (const source of [displayName, email]) {
    const trimmed = source?.trim();
    if (trimmed) {
      // `Array.from` ולא `[0]`: תו מחוץ ל-BMP (אמוג'י) הוא שני code units
      return Array.from(trimmed)[0].toLocaleUpperCase();
    }
  }
  return null;
};
