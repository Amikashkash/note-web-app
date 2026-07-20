/**
 * הורדת קובץ טקסט שנוצר בדפדפן
 */

/**
 * מוריד מחרוזת כקובץ.
 *
 * ה-URL הזמני משוחרר מיד אחרי הלחיצה - בלעדיו התוכן נשאר בזיכרון
 * הדפדפן עד לרענון הדף, וגיבוי של הרבה פתקים אינו קטן.
 */
export const downloadTextFile = (fileName: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
