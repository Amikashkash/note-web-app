/**
 * היסטוריית גרסאות של פתקים (B6, סעיף 11.8 שכבה 3 בסקירה)
 *
 * הגרסאות נכתבות רק כאן, מהטריגר - כך נתפסים כל הכותבים: כל המכשירים,
 * שותפים, ובעתיד MCP. הלקוח לא כותב גרסאות, ולכן אין כתיבה כפולה לכל
 * שמירה אוטומטית.
 *
 * כל גרסה שומרת את מצב הפתק **לפני** השינוי. כך תמיד אפשר לחזור למה
 * שהיה לפני רצף עריכה - גם לפני עריכה של מישהו אחר.
 *
 * Coalescing - גרסה חדשה נוצרת כש:
 * - האחרונה ישנה מ-10 דקות (רצף עריכה אחד = גרסה אחת), או
 * - הכותב התחלף (`updatedBy`), או
 * - קרה אירוע מבני: ארכוב, החלפת תבנית, העברת קטגוריה, שחזור גרסה.
 *
 * שמירה: 50 האחרונות לכל פתק, וכל גרסה עם `expiresAt` של 90 יום. המחיקה
 * לפי `expiresAt` דורשת TTL policy שמוגדרת מחוץ לריפו:
 *   gcloud firestore fields ttls update expiresAt \
 *     --collection-group=versions --enable-ttl --project=notes-4-me
 */

import { Timestamp, type CollectionReference, type DocumentData, type Firestore } from 'firebase-admin/firestore';

export const VERSION_WINDOW_MS = 10 * 60 * 1000;
export const MAX_VERSIONS_PER_NOTE = 50;
export const VERSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * השדות שנשמרים בגרסה. שינוי באחד מהם הוא שינוי תוכן; שינוי רק בשדות
 * אחרים (הצמדה, סדר, `revision`) לא מייצר גרסה.
 */
export const VERSIONED_FIELDS = [
  'title',
  'content',
  'templateType',
  'tags',
  'color',
  'categoryId',
  'isArchived',
] as const;

export type VersionReason = 'archive' | 'template' | 'move' | 'restore' | 'writer' | 'time';

/** השוואה שמתאימה גם למערכים (`tags`) ומתייחסת לשדה חסר כ-`null` */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const versionedFieldsChanged = (before: DocumentData, after: DocumentData): boolean =>
  VERSIONED_FIELDS.some((field) => !same(before[field], after[field]));

/**
 * סיבה שמחייבת גרסה בלי קשר לזמן. `null` - ההחלטה תלויה בגיל הגרסה האחרונה.
 *
 * `restoredAt` (עם `restoredFrom`) הוא סימון שהלקוח כותב בשחזור. בלעדיו,
 * שחזור בתוך חלון 10 הדקות לא היה יוצר גרסה - והמצב שלפני השחזור היה
 * אובד, כלומר אי אפשר היה לבטל את השחזור. לפי הזמן ולא לפי המזהה, כדי
 * שגם שחזור שני של אותה גרסה ייחשב.
 */
export const immediateVersionReason = (before: DocumentData, after: DocumentData): VersionReason | null => {
  if (!same(before.isArchived, after.isArchived)) return 'archive';
  if (!same(before.templateType, after.templateType)) return 'template';
  if (!same(before.categoryId, after.categoryId)) return 'move';
  if (after.restoredAt && !same(before.restoredAt, after.restoredAt)) return 'restore';
  if (!same(before.updatedBy, after.updatedBy)) return 'writer';
  return null;
};

const buildVersion = (
  before: DocumentData,
  after: DocumentData,
  reason: VersionReason,
  now: number
): DocumentData => {
  const snapshot: DocumentData = {};
  for (const field of VERSIONED_FIELDS) {
    if (before[field] !== undefined) snapshot[field] = before[field];
  }

  return {
    ...snapshot,
    // מי כתב את המצב השמור ומתי - זה מה שמוצג ברשימת ההיסטוריה
    authoredBy: before.updatedBy ?? null,
    authoredAt: before.updatedAt ?? null,
    // מי החליף אותו
    replacedBy: after.updatedBy ?? null,
    reason,
    capturedAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + VERSION_TTL_MS),
  };
};

/**
 * שומר רק את `MAX_VERSIONS_PER_NOTE` האחרונות.
 * ספירה דרך aggregation (קריאה אחת לכל 1000 מסמכים) ולא `offset`, שמחויב
 * על כל מסמך שמדלגים עליו.
 */
const trimVersions = async (versions: CollectionReference): Promise<void> => {
  const count = (await versions.count().get()).data().count;
  if (count <= MAX_VERSIONS_PER_NOTE) return;

  const oldest = await versions.orderBy('capturedAt', 'asc').limit(count - MAX_VERSIONS_PER_NOTE).get();
  const batch = versions.firestore.batch();
  oldest.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
};

export const syncVersionsForNote = async (
  db: Firestore,
  noteId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  now: number = Date.now()
): Promise<void> => {
  const versions = db.collection('notes').doc(noteId).collection('versions');

  // מחיקה סופית (מהארכיון) מוחקת גם את ההיסטוריה - הפתק נמחק, ואין
  // סיבה להשאיר עותקים שלו
  if (after === undefined) {
    if (before !== undefined) await db.recursiveDelete(versions);
    return;
  }

  // יצירה - אין מצב קודם לשמור
  if (before === undefined) return;
  if (!versionedFieldsChanged(before, after)) return;

  let reason = immediateVersionReason(before, after);

  if (reason === null) {
    const last = await versions.orderBy('capturedAt', 'desc').limit(1).get();
    const lastAt = last.empty ? null : (last.docs[0].get('capturedAt') as Timestamp).toMillis();
    if (lastAt !== null && now - lastAt < VERSION_WINDOW_MS) return;
    reason = 'time';
  }

  await versions.add(buildVersion(before, after, reason, now));
  await trimVersions(versions);
};
