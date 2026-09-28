/**
 * נרמול מסמכי Firestore לטיפוסים של notesCore.
 *
 * מראה מותאמת של `src/services/api/mappers.ts`: אותם שדות ואותן ברירות
 * מחדל, עם שני הבדלים מכוונים:
 * - תאריכים כמחרוזות ISO. תאריך חסר הוא `null` ולא "עכשיו" - השרת לא
 *   ממיין לפי זמן תצוגה, ו-`null` לא ממציא מידע.
 * - הקובץ לא מייבא את Firestore (ESLint, mcp-plan §3.2.7). Timestamp
 *   מזוהה לפי הצורה שלו (`toDate`), כך ש-`store.ts` הוא עדיין היחיד שמכיר את ה-SDK.
 */

import type { CategoryRecord, NoteRecord, NoteVersion, VersionReason } from './model';

type Data = Record<string, unknown>;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Timestamp של Firestore (Admin) לפי הצורה, בלי לייבא את הטיפוס */
const asIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const toDate = (value as { toDate?: unknown }).toDate;
  if (typeof toDate !== 'function') return null;
  const date: unknown = toDate.call(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

export const toNoteRecord = (id: string, data: Data): NoteRecord => {
  const createdAt = asIsoDate(data.createdAt);
  return {
    id,
    title: asString(data.title),
    content: asString(data.content),
    categoryId: asString(data.categoryId),
    templateType: asString(data.templateType, 'plain'),
    tags: asStringArray(data.tags),
    color: asNullableString(data.color),
    order: asNumber(data.order),
    userId: asString(data.userId),
    sharedWith: asStringArray(data.sharedWith),
    isPinned: asBoolean(data.isPinned),
    isArchived: asBoolean(data.isArchived),
    // ⚠️ כאן, ורק כאן, ערך שאינו בוליאני נחשב רגיש: `isSensitive: 'true'`
    // שנכתב בטעות לא יחשוף פתק. האפליקציה כותבת רק בוליאני.
    isSensitive: data.isSensitive === undefined ? false : data.isSensitive !== false,
    // אותו fail-closed: ערך שאינו בוליאני נחשב קריאה בלבד
    isReadOnly: data.isReadOnly === undefined ? false : data.isReadOnly !== false,
    createdVia: data.createdVia === 'mcp' ? 'mcp' : null,
    revision: asNumber(data.revision),
    createdAt,
    updatedAt: asIsoDate(data.updatedAt) ?? createdAt,
    archivedAt: asIsoDate(data.archivedAt),
    updatedBy: asNullableString(data.updatedBy),
  };
};

export const toCategoryRecord = (id: string, data: Data): CategoryRecord => {
  const createdAt = asIsoDate(data.createdAt);
  return {
    id,
    name: asString(data.name),
    color: asString(data.color, '#3B82F6'),
    icon: asNullableString(data.icon),
    order: asNumber(data.order),
    userId: asString(data.userId),
    sharedWith: asStringArray(data.sharedWith),
    // אותו fail-closed כמו בפתק
    isSensitive: data.isSensitive === undefined ? false : data.isSensitive !== false,
    isReadOnly: data.isReadOnly === undefined ? false : data.isReadOnly !== false,
    createdAt,
    updatedAt: asIsoDate(data.updatedAt) ?? createdAt,
  };
};

const VERSION_REASONS: readonly VersionReason[] = ['archive', 'template', 'move', 'restore', 'writer', 'time'];

export const toNoteVersion = (id: string, data: Data): NoteVersion => ({
  id,
  title: asString(data.title),
  content: asString(data.content),
  templateType: asString(data.templateType, 'plain'),
  tags: asStringArray(data.tags),
  color: asNullableString(data.color),
  categoryId: asString(data.categoryId),
  isArchived: asBoolean(data.isArchived),
  authoredBy: asNullableString(data.authoredBy),
  authoredAt: asIsoDate(data.authoredAt),
  replacedBy: asNullableString(data.replacedBy),
  reason: VERSION_REASONS.includes(data.reason as VersionReason) ? (data.reason as VersionReason) : 'time',
  capturedAt: asIsoDate(data.capturedAt),
});
