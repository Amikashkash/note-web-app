/**
 * מיזוג תלת-כיווני של תוכן פתק (C-1): הגרסה שהעריכה התחילה ממנה (base),
 * מה שהמשתמש שינה מקומית (local), ומה שהגיע מהשרת בינתיים (remote).
 *
 * - **תבניות רשימה** (משימות, קניות, תכנית עבודה, חשבונאות): לפי `id` של
 *   כל פריט. שינויים בפריטים שונים מתמזגים. אותו פריט שהשתנה בשני הצדדים
 *   ממוזג **לפי שדה** (`mergeItem`): אחד סימן "בוצע", השני שינה טקסט -
 *   שניהם נשמרים. אותו שדה שונה בשני הצדדים, או פריט שנערך בצד אחד ונמחק
 *   בשני - התנגשות. הסדר: של השרת, אלא אם רק המשתמש שינה אותו (גרירה) -
 *   אז הסדר שלו. שני הצדדים שינו סדר - של השרת: סדר הוא לא תוכן, ולא
 *   שווה התנגשות.
 * - **טקסט:** רק מקרה אחד בטוח: השרת כבר מכיל את כל מה שנכתב מקומית
 *   (למשל הכתיבה שלנו אושרה ו-Claude הוסיף בסוף). כל השאר - התנגשות.
 *   אין מיזוג טקסט אוטומטי (החלטה ב-review §11.7ב).
 *
 * התנגשות = אי אפשר למזג בבטחה, והקורא מציג למשתמש בחירה. **לעולם לא
 * מנחשים**: עדיף לשאול מאשר לאבד טקסט. ההתנגשות מגיעה עם סיבה ושמות
 * השדות (בלי תוכן), למדידה: האם צריך את E1 (`thinking/round2-plan.md`).
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

/** `undefined` ושדה חסר שווים: JSON לא שומר `undefined` */
const equal = (a: unknown, b: unknown) => stable(a ?? null) === stable(b ?? null);

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

// ---------------------------------------------------------------------------
// התנגשות: סיבה ושדות, בלי תוכן
// ---------------------------------------------------------------------------

export type ConflictReason =
  /** הכותרת שונתה בשני הצדדים, אחרת */
  | 'title'
  /** טקסט חופשי שנערך בשני הצדדים */
  | 'text'
  /** רשימה בלי מזהים יציבים, או תוכן שאינו רשימה */
  | 'unreadable'
  /** אותו פריט, אותו שדה, ערכים שונים */
  | 'same-field'
  /** משימה: יחידת התזמון (ראו `mergeItem`) שונתה בשני הצדדים */
  | 'schedule'
  /** פריט שנערך בצד אחד ונמחק בשני */
  | 'edit-vs-delete'
  /** אותו מזהה נוסף בשני הצדדים, בתוכן שונה */
  | 'both-added'
  /** העורך נפתח על כתיבה ממתינה (מסשן קודם / לשונית אחרת), והשרת מחזיק משהו אחר (`noteSync.ts`) */
  | 'unconfirmed';

export interface MergeConflict {
  reason: ConflictReason;
  /** שמות השדות שהתנגשו: רק שמות ידועים, כל שם אחר - `other`. בלי ערכים */
  fields: string[];
}

export const REPORTABLE_FIELDS = [
  'text', 'completed', 'dueDate', 'dueTime', 'repeat', 'repeatBase', 'priority',
  'name', 'quantity', 'checked',
  'header', 'content',
  'description', 'amount', 'date',
  'other',
] as const;

const reportable = (fields: string[]): string[] => [
  ...new Set(fields.map((field) => ((REPORTABLE_FIELDS as readonly string[]).includes(field) ? field : 'other'))),
];

// ---------------------------------------------------------------------------
// פריט אחד, לפי שדה
// ---------------------------------------------------------------------------

/** שדות התזמון של משימה: נקבעים יחד, ולכן ממוזגים כיחידה אחת */
const SCHEDULE_FIELDS = ['dueDate', 'dueTime', 'repeat', 'repeatBase'];

const isRecurring = (...rows: Row[]) => rows.some((row) => typeof row.repeat === 'string' && row.repeat !== '');

export type ItemMerge = { item: Row } | { conflict: MergeConflict };

/**
 * מיזוג תלת-כיווני של פריט שקיים בשלוש הגרסאות. כל **יחידה** נלקחת
 * מהצד ששינה אותה. שינו שניהם לאותו ערך - בסדר. לערכים שונים - התנגשות.
 *
 * יחידה היא שדה בודד, חוץ משדות שתלויים זה בזה:
 * - **תזמון** (`dueDate`, `dueTime`, `repeat`, `repeatBase`): `repeatBase`
 *   תקף רק כל עוד `dueDate` הוא מופע שלו; `repeat` בלי תאריך ושעה לא חוזר;
 *   העורך מנקה אותם יחד. ערבוב (תאריך מצד אחד, חזרה מהשני) היה מייצר
 *   צירוף שאף אחד לא בחר.
 * - **`completed` של משימה חוזרת** (`repeat` באחת משלוש הגרסאות) מצטרף
 *   לתזמון. הטריגר בשרת (`functions/src/recurringTasks.ts`) מאפס משימה
 *   חוזרת שסומנה: `completed` חוזר ל-false ו-`dueDate` מתקדם. אם צד אחד
 *   סימן "בוצע" והצד השני הוא איפוס של סימון אחר (או הזזת תאריך ביד),
 *   מיזוג לפי שדה היה כותב `completed: true` עם התאריך החדש - והטריגר
 *   היה מקדם **שוב**, ומדלג על מופע. לכן: בחירה. איפוס שמגיע כשהצד השני
 *   שינה רק טקסט או עדיפות - ממוזג, כרגיל.
 * - כל השאר עצמאי: `text`, `priority`, `completed` של משימה רגילה; `name`,
 *   `quantity`, `checked`; `header`, `content`; `description`, `amount`, `date`.
 *
 * סדר המפתחות: של השרת, ואחריו שדות שנוספו בצד המקומי.
 */
export const mergeItem = (base: Row, local: Row, remote: Row): ItemMerge => {
  const keys = [...new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(base)])];
  const schedule = isRecurring(base, local, remote) ? [...SCHEDULE_FIELDS, 'completed'] : SCHEDULE_FIELDS;
  const units = [
    schedule.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !schedule.includes(key)).map((key) => [key]),
  ].filter((unit) => unit.length > 0);

  const merged: Row = {};
  for (const unit of units) {
    const localChanged = unit.filter((key) => !equal(local[key], base[key]));
    const remoteChanged = unit.filter((key) => !equal(remote[key], base[key]));
    const bothChanged = localChanged.length > 0 && remoteChanged.length > 0;
    if (bothChanged && !unit.every((key) => equal(local[key], remote[key]))) {
      const isSchedule = unit.length > 1;
      return {
        conflict: {
          reason: isSchedule ? 'schedule' : 'same-field',
          fields: reportable(isSchedule ? [...new Set([...localChanged, ...remoteChanged])] : unit),
        },
      };
    }
    const from = localChanged.length > 0 && remoteChanged.length === 0 ? local : remote;
    for (const key of unit) if (from[key] !== undefined) merged[key] = from[key];
  }
  return { item: Object.fromEntries(keys.filter((key) => key in merged).map((key) => [key, merged[key]])) };
};

// ---------------------------------------------------------------------------
// רשימה
// ---------------------------------------------------------------------------

type Resolved = { row: Row | undefined } | { conflict: MergeConflict };

const mergeRows = (
  baseContent: string,
  localContent: string,
  remoteContent: string
): { content: string } | { conflict: MergeConflict } => {
  const [base, local, remote] = [baseContent, localContent, remoteContent].map(rowsWithIds);
  if (!base || !local || !remote) return { conflict: { reason: 'unreadable', fields: [] } };

  const byId = (rows: Row[]) => new Map(rows.map((row) => [row.id as string, row]));
  const [baseById, localById, remoteById] = [byId(base), byId(local), byId(remote)];
  const same = (a: Row | undefined, b: Row | undefined) => equal(a, b);

  /** הגרסה הממוזגת של פריט: `row: undefined` = נמחק */
  const resolve = (id: string): Resolved => {
    const [b, l, r] = [baseById.get(id), localById.get(id), remoteById.get(id)];
    if (same(l, b)) return { row: r };
    if (same(r, b)) return { row: l };
    if (same(l, r)) return { row: l };
    if (!b) return { conflict: { reason: 'both-added', fields: [] } };
    if (!l || !r) return { conflict: { reason: 'edit-vs-delete', fields: [] } };
    const result = mergeItem(b, l, r);
    return 'item' in result ? { row: result.item } : result;
  };

  // הסדר מהשרת, ופריטים שנוספו מקומית נכנסים אחרי הפריט שקדם להם מקומית
  const merged: Row[] = [];
  for (const row of remote) {
    const resolved = resolve(row.id as string);
    if ('conflict' in resolved) return resolved;
    if (resolved.row) merged.push(resolved.row);
  }
  for (let index = 0; index < local.length; index++) {
    const id = local[index].id as string;
    if (remoteById.has(id)) continue;
    const resolved = resolve(id);
    if ('conflict' in resolved) return resolved;
    if (!resolved.row) continue;
    // אחרי הפריט שקדם לו אצל המשתמש. היה ראשון - בהתחלה. הקודם כבר לא ברשימה - בסוף
    const previousId = index > 0 ? (local[index - 1].id as string) : null;
    const previousAt = previousId === null ? -1 : merged.findIndex((item) => item.id === previousId);
    const at = previousId === null ? 0 : previousAt >= 0 ? previousAt + 1 : merged.length;
    merged.splice(at, 0, resolved.row);
  }

  return { content: JSON.stringify(keepLocalOrder(base, local, remote, merged)) };
};

/**
 * אם רק המשתמש שינה את סדר הפריטים (גרירה), הסדר שלו נשמר: הפריטים
 * שקיימים בשלוש הגרסאות מסודרים כמו אצלו, במקומות שלהם ברשימה הממוזגת.
 * פריטים שנוספו בצד אחד נשארים איפה שהמיזוג שם אותם.
 */
const keepLocalOrder = (base: Row[], local: Row[], remote: Row[], merged: Row[]): Row[] => {
  const idsOf = (rows: Row[]) => rows.map((row) => row.id as string);
  const inAll = new Set(
    idsOf(base).filter((id) => idsOf(local).includes(id) && idsOf(remote).includes(id))
  );
  const orderOf = (rows: Row[]) => idsOf(rows).filter((id) => inAll.has(id) && merged.some((row) => row.id === id));
  const [baseOrder, localOrder, remoteOrder] = [orderOf(base), orderOf(local), orderOf(remote)];
  const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);
  if (sameOrder(localOrder, baseOrder) || !sameOrder(remoteOrder, baseOrder)) return merged;

  const byId = new Map(merged.map((row) => [row.id as string, row]));
  let next = 0;
  return merged.map((row) => (localOrder.includes(row.id as string) ? (byId.get(localOrder[next++]) as Row) : row));
};

// ---------------------------------------------------------------------------
// פתק
// ---------------------------------------------------------------------------

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

export type MergeResult = { merged: NoteText } | { conflict: MergeConflict };

/**
 * המיזוג, או ההתנגשות עם הסיבה. `templateType` - של הגרסה המרוחקת
 * (אם הוא שונה מהמקומית, אין מיזוג).
 */
export const mergeNote = (
  base: NoteText,
  local: NoteText,
  remote: NoteText,
  templateType: string
): MergeResult => {
  const title = mergeTitle(base.title, local.title, remote.title);
  if (title === null) return { conflict: { reason: 'title', fields: [] } };

  if (local.content === base.content) return { merged: { title, content: remote.content } };
  if (remote.content === base.content || remote.content === local.content) {
    return { merged: { title, content: local.content } };
  }

  if (ITEM_TEMPLATES.has(templateType)) {
    const rows = mergeRows(base.content, local.content, remote.content);
    return 'content' in rows ? { merged: { title, content: rows.content } } : rows;
  }

  // טקסט: השרת כבר כולל את כל מה שנכתב כאן (והוסיף אחריו)
  if (remote.content.startsWith(local.content) && local.content.startsWith(base.content)) {
    return { merged: { title, content: remote.content } };
  }
  return { conflict: { reason: 'text', fields: [] } };
};
