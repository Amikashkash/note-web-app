/**
 * שינוי הסדר של משימות בגרירה.
 *
 * הרשימה מוצגת עם הפתוחות קודם והמסומנות כבוצעו בסוף (`openTasksFirst`),
 * ולכן גוררים רק בתוך אותה קבוצה: משימה פתוחה בין הפתוחות, ומסומנת בין
 * המסומנות. גרירה בין הקבוצות לא הייתה נשארת במקום ממילא.
 *
 * הסדר החדש של הקבוצה נכתב **למקומות שלה** ברשימה השמורה, והקבוצה
 * האחרת לא זזה. כך משימה שמבטלים את הסימון שלה עדיין חוזרת למקומה.
 *
 * טהור - בלי React ובלי Firebase.
 */

/** הרשימה אחרי הזזת `activeId` למקום של `overId`, או `null` אם אין מה להזיז */
export const moveTask = <T extends { id: string; completed: boolean }>(
  items: readonly T[],
  activeId: string,
  overId: string
): T[] | null => {
  if (activeId === overId) return null;
  const active = items.find((item) => item.id === activeId);
  const over = items.find((item) => item.id === overId);
  if (!active || !over || active.completed !== over.completed) return null;

  const group = items.filter((item) => item.completed === active.completed);
  const from = group.indexOf(active);
  const to = group.indexOf(over);
  const reordered = [...group];
  reordered.splice(from, 1);
  reordered.splice(to, 0, active);

  let next = 0;
  return items.map((item) => (item.completed === active.completed ? reordered[next++] : item));
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, low: 2 };

/** סדר לפי עדיפות: דחופות, רגילות, נמוכות - ובתוך כל רמה הסדר הנוכחי */
export const byPriority = <T extends { priority?: string }>(items: readonly T[]): T[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (PRIORITY_RANK[a.item.priority ?? ''] ?? 1) - (PRIORITY_RANK[b.item.priority ?? ''] ?? 1) || a.index - b.index)
    .map(({ item }) => item);

/**
 * "מיין לפי עדיפות": פעולה חד-פעמית שנשמרת, כמו גרירה - לא מצב תצוגה.
 * כל קבוצה (פתוחות / בוצעו) ממוינת **במקומות שלה**, כמו ב-`moveTask`,
 * כך שמשימה שמבטלים את הסימון שלה עדיין חוזרת למקום סביר.
 * `null` כשהרשימה כבר ממוינת - אין מה לשמור.
 */
export const sortTasksByPriority = <T extends { id: string; completed: boolean; priority?: string }>(
  items: readonly T[]
): T[] | null => {
  const open = byPriority(items.filter((item) => !item.completed));
  const done = byPriority(items.filter((item) => item.completed));
  let nextOpen = 0;
  let nextDone = 0;
  const sorted = items.map((item) => (item.completed ? done[nextDone++] : open[nextOpen++]));
  return sorted.every((item, index) => item === items[index]) ? null : sorted;
};
