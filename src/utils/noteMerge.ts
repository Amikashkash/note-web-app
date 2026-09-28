/**
 * מיזוג תלת-כיווני של תוכן פתק (C-1): הגרסה שהעריכה התחילה ממנה (base),
 * מה שהמשתמש שינה מקומית (local), ומה שהגיע מהשרת בינתיים (remote).
 *
 * - **תבניות רשימה** (משימות, קניות, תכנית עבודה, חשבונאות): לפי `id` של
 *   כל פריט. שינויים בפריטים שונים מתמזגים. אותו פריט שונה בשני הצדדים
 *   באופן שונה, או נערך בצד אחד ונמחק בשני - התנגשות.
 * - **טקסט:** רק מקרה אחד בטוח: השרת כבר מכיל את כל מה שנכתב מקומית
 *   (למשל הכתיבה שלנו אושרה ו-Claude הוסיף בסוף). כל השאר - התנגשות.
 *   אין מיזוג טקסט אוטומטי (החלטה ב-review §11.7ב).
 *
 * `null` = אי אפשר למזג בבטחה, והקורא מציג למשתמש בחירה. **לעולם לא
 * מנחשים**: עדיף לשאול מאשר לאבד טקסט.
 *
 * טהור - בלי React ובלי Firebase.
 */

type Row = Record<string, unknown>;

const ITEM_TEMPLATES = new Set(['checklist', 'shopping', 'workplan', 'accounting']);

/** JSON עם מפתחות ממוינים, כדי שסדר שדות שונה לא ייחשב שינוי */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Row)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Row)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

/**
 * שורות עם מזהה ייחודי לכל אחת, או `null`. בלי מזהים יציבים אי אפשר
 * לדעת איזה פריט הוא איזה, ולכן לא ממזגים.
 */
const rowsWithIds = (content: string): Row[] | null => {
  if (content.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const ids = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const id = (row as Row).id;
    if (typeof id !== 'string' || id === '' || ids.has(id)) return null;
    ids.add(id);
  }
  return parsed as Row[];
};

const mergeRows = (baseContent: string, localContent: string, remoteContent: string): string | null => {
  const [base, local, remote] = [baseContent, localContent, remoteContent].map(rowsWithIds);
  if (!base || !local || !remote) return null;

  const byId = (rows: Row[]) => new Map(rows.map((row) => [row.id as string, row]));
  const [baseById, localById, remoteById] = [byId(base), byId(local), byId(remote)];
  const same = (a: Row | undefined, b: Row | undefined) => stable(a ?? null) === stable(b ?? null);

  /** הגרסה הממוזגת של פריט, `undefined` = נמחק, `null` = התנגשות */
  const resolve = (id: string): Row | undefined | null => {
    const [b, l, r] = [baseById.get(id), localById.get(id), remoteById.get(id)];
    if (same(l, b)) return r;
    if (same(r, b)) return l;
    if (same(l, r)) return l;
    return null;
  };

  // הסדר מהשרת, ופריטים שנוספו מקומית נכנסים אחרי הפריט שקדם להם מקומית
  const merged: Row[] = [];
  for (const row of remote) {
    const resolved = resolve(row.id as string);
    if (resolved === null) return null;
    if (resolved) merged.push(resolved);
  }
  for (let index = 0; index < local.length; index++) {
    const row = local[index];
    const id = row.id as string;
    if (remoteById.has(id)) continue;
    const resolved = resolve(id);
    if (resolved === null) return null;
    if (!resolved) continue;
    // אחרי הפריט שקדם לו אצל המשתמש. היה ראשון - בהתחלה. הקודם כבר לא ברשימה - בסוף
    const previousId = index > 0 ? (local[index - 1].id as string) : null;
    const previousAt = previousId === null ? -1 : merged.findIndex((item) => item.id === previousId);
    const at = previousId === null ? 0 : previousAt >= 0 ? previousAt + 1 : merged.length;
    merged.splice(at, 0, resolved);
  }

  return JSON.stringify(merged);
};

export interface NoteText {
  title: string;
  content: string;
}

/** כותרת: שדה קצר. השתנתה רק בצד אחד - הצד הזה. בשניהם אחרת - התנגשות */
const mergeTitle = (base: string, local: string, remote: string): string | null => {
  if (local === base) return remote;
  if (remote === base || remote === local) return local;
  return null;
};

/**
 * המיזוג, או `null` כשאין מיזוג בטוח. `templateType` - של הגרסה המרוחקת
 * (אם הוא שונה מהמקומית, אין מיזוג).
 */
export const mergeNote = (
  base: NoteText,
  local: NoteText,
  remote: NoteText,
  templateType: string
): NoteText | null => {
  const title = mergeTitle(base.title, local.title, remote.title);
  if (title === null) return null;

  if (local.content === base.content) return { title, content: remote.content };
  if (remote.content === base.content || remote.content === local.content) return { title, content: local.content };

  if (ITEM_TEMPLATES.has(templateType)) {
    const content = mergeRows(base.content, local.content, remote.content);
    return content === null ? null : { title, content };
  }

  // טקסט: השרת כבר כולל את כל מה שנכתב כאן (והוסיף אחריו)
  if (remote.content.startsWith(local.content) && local.content.startsWith(base.content)) {
    return { title, content: remote.content };
  }
  return null;
};
