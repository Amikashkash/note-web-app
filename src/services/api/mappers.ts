/**
 * המרת מסמכי Firestore לטיפוסים של האפליקציה
 *
 * למה זה קיים: הטיפוסים `Note` ו-`Category` מבטיחים ששדות כמו `tags`,
 * `sharedWith` ו-`updatedAt` תמיד קיימים - אבל Firestore לא מבטיח כלום.
 * מסמכים שנוצרו בגרסאות קודמות (לפני שהשדה נוסף) מגיעים חסרים, ואז
 * קוד תמים כמו `note.tags.length` קורס.
 *
 * במקום לפזר `?.` ו-`|| []` בכל קומפוננטה, כל המסמכים עוברים דרך כאן
 * ויוצאים מנורמלים. אחרי הנקודה הזו הטיפוסים אמינים.
 */

import { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import type { Note, TemplateType } from '@/types/note';
import type { Category } from '@/types';

type AnySnapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asTimestamp = (value: unknown, fallback: Timestamp): Timestamp =>
  value instanceof Timestamp ? value : fallback;

const asOptionalTimestamp = (value: unknown): Timestamp | null =>
  value instanceof Timestamp ? value : null;

/**
 * המרת מסמך פתק ל-`Note` מנורמל
 */
export const toNote = (snapshot: AnySnapshot): Note => {
  const data = snapshot.data() ?? {};
  // פתקים ישנים מלפני הוספת חותמות הזמן - נופלים לזמן הנוכחי
  // כדי שהמיון והתצוגה לא יקרסו.
  const now = Timestamp.now();
  const createdAt = asTimestamp(data.createdAt, now);

  return {
    id: snapshot.id,
    title: asString(data.title),
    content: asString(data.content),
    categoryId: asString(data.categoryId),
    templateType: (asString(data.templateType, 'plain') as TemplateType),
    tags: asStringArray(data.tags),
    color: typeof data.color === 'string' ? data.color : null,
    order: asNumber(data.order),
    userId: asString(data.userId),
    sharedWith: asStringArray(data.sharedWith),
    createdAt,
    updatedAt: asTimestamp(data.updatedAt, createdAt),
    isPinned: asBoolean(data.isPinned),
    isArchived: asBoolean(data.isArchived),
    archivedAt: asOptionalTimestamp(data.archivedAt) ?? undefined,
    reminderTime: asOptionalTimestamp(data.reminderTime),
    reminderEnabled: asBoolean(data.reminderEnabled),
  };
};

/**
 * המרת מסמך קטגוריה ל-`Category` מנורמל
 */
export const toCategory = (snapshot: AnySnapshot): Category => {
  const data = snapshot.data() ?? {};
  const now = Timestamp.now();
  const createdAt = asTimestamp(data.createdAt, now);

  return {
    id: snapshot.id,
    name: asString(data.name),
    color: asString(data.color, '#3B82F6'),
    icon: typeof data.icon === 'string' ? data.icon : null,
    order: asNumber(data.order),
    userId: asString(data.userId),
    sharedWith: asStringArray(data.sharedWith),
    createdAt,
    updatedAt: asTimestamp(data.updatedAt, createdAt),
  };
};

/**
 * מיון פתקים: מוצמדים תחילה, אחר כך לפי `order`
 */
export const byPinnedThenOrder = (a: Note, b: Note): number => {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  return a.order - b.order;
};
