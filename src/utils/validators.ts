/**
 * פונקציות ולידציה
 */

/**
 * ולידציה לאימייל
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * ולידציה לסיסמה
 * לפחות 6 תווים
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * ולידציה לשם קטגוריה
 */
export const isValidCategoryName = (name: string): boolean => {
  return name.trim().length > 0 && name.trim().length <= 50;
};

/**
 * ולידציה לכותרת פתק
 */
export const isValidNoteTitle = (title: string): boolean => {
  return title.trim().length > 0 && title.trim().length <= 100;
};

/**
 * ולידציה לצבע (hex)
 */
export const isValidColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
};
