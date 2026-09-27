/**
 * פתקים רגישים: בלתי נראים ל-MCP (mcp-plan §3.4).
 *
 * פונקציה אחת, ו-`UserScope` הוא היחיד שקורא לה. אף קורא אחר לא בודק
 * רגישות בעצמו.
 */

interface SensitivityFlag {
  isSensitive: boolean;
}

/**
 * האם הפתק גלוי. **fail-closed**: הפתק מוסתר אם הדגל שלו מסומן, אם
 * הדגל של הקטגוריה שלו מסומן, או אם הקטגוריה לא נמצאה (נמחקה, מזהה
 * שבור או ריק). עדיף פתק יתום שלא נגיש ל-Claude מאשר פתק מקטגוריה רגישה
 * שנמחקה שנחשף.
 *
 * `categoriesById` צריך להכיל את הקטגוריה של **הבעלים**, גם כשהיא לא
 * משותפת עם המשתמש המבקש - הדגל של הבעלים חל על כולם.
 */
export const isVisibleToMcp = (
  note: SensitivityFlag & { categoryId: string },
  categoriesById: ReadonlyMap<string, SensitivityFlag>
): boolean => {
  if (note.isSensitive) return false;
  const category = categoriesById.get(note.categoryId);
  return category !== undefined && !category.isSensitive;
};
