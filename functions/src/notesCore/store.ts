/**
 * `UserScope` - הגישה היחידה של notesCore ל-Firestore (mcp-plan §3.2).
 *
 * ה-Admin SDK עוקף את `firestore.rules`, ולכן הבדיקות שה-rules עושים
 * באפליקציה נעשות כאן, במקום אחד:
 * - **בעלות:** כל שאילתה מסוננת לפי `uid` של הזהות המאומתת, וכל גישה
 *   לפי מזהה עוברת ב-`loadNoteForUser` / `loadCategoryForUser`.
 * - **רגישות (§3.4):** כל פתק וקטגוריה עוברים דרך `isVisibleToMcp`.
 *   פתק רגיש, פתק בקטגוריה רגישה ופתק שהקטגוריה שלו לא נמצאה - מוסתרים.
 * - **`NotFound` אחד:** פתק שלא קיים, פתק של משתמש אחר ופתק רגיש
 *   מחזירים את אותה שגיאה בדיוק.
 *
 * ESLint (`eslint.config.js`) חוסם ייבוא של Firestore בכל `functions/src`
 * חוץ מכאן ומהקבצים שהחזיקו אותו לפני notesCore. `db` הוא שדה פרטי
 * (`#db`) ואין שום API שמקבל שאילתה חופשית.
 *
 * ב-PR הזה אין ל-`UserScope` אף קורא מחוץ לבדיקות: לא נקרא מ-`index.ts`
 * ולא רץ בפרודקשן. הקורא הראשון יהיה שרת ה-MCP (שלב 1ג).
 */

import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, getFirestore, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import {
  AUDIT_RETENTION_MS,
  noteCreatedEntry,
  noteEditedEntry,
  type AuditAction,
  type NoteCreatedSummary,
  type WriteActor,
} from './audit';
import { ForbiddenError, InvalidError, NotFoundError, OpenElsewhereError, ReadOnlyError } from './errors';
import { isVerifiedIdentity, type VerifiedIdentity } from './identity';
import { toCategoryRecord, toNoteRecord, toNoteVersion } from './mappers';
import type { Access, Category, CategoryRecord, Note, NoteRecord, NoteVersion } from './model';
import { LIMITS, accessOf, satisfies, type Need } from './permissions';
import { searchNotes, type SearchHit } from './search';
import { isReadOnlyForMcp, isVisibleToMcp } from './visibility';

const NOTES = 'notes';
const CATEGORIES = 'categories';
const VERSIONS = 'versions';
const AUDIT = 'auditLog';
const REMINDERS = 'reminders';
const IDEMPOTENCY = 'mcpIdempotency';

/** חלון מניעת הכפילויות של `createNote` ו-`editNote` */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * סימון "הפתק פתוח" שרוענן בדקה האחרונה נחשב פתוח. זהה ל-`PRESENCE_TTL_MS`
 * באפליקציה (`src/utils/presence.ts`): העורך מרענן כל 30 שניות.
 */
export const PRESENCE_TTL_MS = 60 * 1000;

/** מספר הגרסאות המרבי שמוחזר - אותו סדר גודל כמו מה שהאפליקציה שומרת */
const MAX_VERSIONS = 50;

/**
 * מזהה שאפשר לבנות ממנו נתיב מסמך. מזהה אחר (ריק, עם `/`, ארוך מדי)
 * לא יכול להתאים לשום מסמך, ומטופל כמו מסמך שלא קיים.
 */
const isDocId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= LIMITS.id && !id.includes('/');

const withoutSensitive = <T extends { isSensitive: boolean }>({ isSensitive: _, ...rest }: T) => rest;

/** `isReadOnly` מוחלף בערך האפקטיבי (פתק או קטגוריה) */
const toNote = (record: NoteRecord, access: Access, isReadOnly: boolean): Note => ({
  ...withoutSensitive(record),
  isReadOnly,
  access,
});

const toCategory = (record: CategoryRecord, access: Access): Category => ({
  ...withoutSensitive(record),
  access,
});

/** מוצמדים תחילה, אחר כך לפי `order` - כמו `byPinnedThenOrder` באפליקציה */
const byPinnedThenOrder = (a: Note, b: Note): number =>
  Number(b.isPinned) - Number(a.isPinned) || a.order - b.order;

export interface ListNotesOptions {
  /**
   * `false` (ברירת מחדל): פתקים פעילים, בבעלות ומשותפים.
   * `true`: רק פתקים מאורכבים **בבעלות** המשתמש, כמו `subscribeToArchivedNotes`.
   */
  archived?: boolean;
}

export interface SearchOptions {
  /** לכלול גם פתקים מאורכבים בבעלות המשתמש */
  includeArchived?: boolean;
}

/** פתק מוכן ליצירה. נבנה ומאומת ב-`mcp/createNote.ts` */
export interface NoteDraft {
  categoryId: string;
  title: string;
  templateType: 'plain' | 'checklist' | 'shopping' | 'workplan';
  /** התוכן בפורמט של האפליקציה (טקסט, או JSON של הפריטים) */
  content: string;
  /** זהה לשני פתקים זהים - בלי מזהים שנוצרו ובלי זמנים. למניעת כפילויות */
  fingerprint: string;
  summary: Omit<NoteCreatedSummary, 'categoryName'>;
}

export interface CreateNoteResult {
  note: Note;
  categoryName: string;
  /** `true` כשפתק זהה נוצר בחלון של 10 הדקות, והוחזר הוא במקום ליצור חדש */
  duplicate: boolean;
}

/** עריכה של פתק קיים (שלב 2ב-lite). נבנית ומאומתת ב-`mcp/editNote.ts` */
export interface NoteEdit {
  action: Exclude<AuditAction, 'note.create'>;
  /**
   * מחיל את השינוי על **הגרסה העדכנית** של הפתק, בתוך ה-transaction.
   * `null` - אין מה לשנות (הערכים כבר כאלה). שגיאה - `InvalidError`.
   */
  apply: (note: NoteRecord, context?: EditContext) => EditOutcome | null;
  /** בקשה זהה בתוך 10 דקות לא מוחלת פעמיים (append אחרי timeout) */
  fingerprint?: string;
  /** `any` - גם פתק מאורכב (ארכוב ושחזור). ברירת מחדל: רק פתק פעיל */
  archived?: 'active' | 'any';
  /** קטגוריית יעד (העברה): נקראת בתוך ה-transaction ומועברת ל-`apply` */
  targetCategoryId?: string;
}

/** מה ש-`editNote` קרא בשביל העריכה, בתוך ה-transaction */
export interface EditContext {
  /** קטגוריית היעד, אם `targetCategoryId` - `null` כשלא קיימת */
  targetCategory: CategoryRecord | null;
}

/**
 * התזכורות של הפתק, שמשתנות **באותו transaction** של העריכה - כדי שלא
 * יהיה רגע שבו פתק מאורכב או משימה שנמחקה עדיין שולחים. הטריגר
 * (`onNoteWritten`) מסנכרן אחר כך כרגיל, ומגיע לאותה תוצאה.
 */
export type ReminderChange =
  | { kind: 'deleteAll' }
  | { kind: 'deleteItems'; itemIds: string[] }
  | { kind: 'setCategory'; categoryId: string };

export interface EditOutcome {
  /** תוכן חדש. חסר - התוכן לא משתנה */
  content?: string;
  /** שדות אחרים של הפתק (ארכיון, קטגוריה) */
  fields?: Partial<Pick<NoteRecord, 'isArchived' | 'categoryId'>>;
  reminders?: ReminderChange;
  /** לרשימת "פעילות Claude" */
  description: string;
  /** החלק שהשתנה, לפני ואחרי, ל-audit */
  before: unknown;
  after: unknown;
}

/** קטגוריית יעד שלא קיימת, של משתמש אחר, או רגישה - בלי לומר איזה מהם */
export class TargetCategoryNotFoundError extends NotFoundError {}

export interface EditNoteResult {
  note: Note;
  /** `false` - לא היה מה לשנות */
  changed: boolean;
  /** בקשה זהה כבר הוחלה בחלון של 10 דקות */
  duplicate: boolean;
}

export class UserScope {
  readonly uid: string;
  readonly #db: Firestore;

  private constructor(identity: VerifiedIdentity, db: Firestore) {
    this.uid = identity.uid;
    this.#db = db;
  }

  /**
   * הדרך היחידה ליצור `UserScope`. הבדיקה בזמן ריצה משלימה את הטיפוס:
   * גם `{ uid } as VerifiedIdentity` נדחה, כי הוא לא יצא מ-`mintVerifiedIdentity`.
   *
   * `db` מוזרק רק בבדיקות (emulator). קוד אחר לא יכול להשיג `Firestore`
   * בלי לייבא את ה-SDK, ו-ESLint חוסם את זה.
   */
  static for(identity: VerifiedIdentity, db: Firestore = getFirestore()): UserScope {
    if (!isVerifiedIdentity(identity)) throw new Error('UserScope requires a verified identity');
    return new UserScope(identity, db);
  }

  // -------------------------------------------------------------------------
  // קטגוריות
  // -------------------------------------------------------------------------

  /** קטגוריות בבעלות ומשותפות, בלי הרגישות, ממוינות לפי `order` */
  async listAccessibleCategories(): Promise<Category[]> {
    const categories = this.#db.collection(CATEGORIES);
    const [owned, shared] = await Promise.all([
      categories.where('userId', '==', this.uid).get(),
      categories.where('sharedWith', 'array-contains', this.uid).get(),
    ]);

    const byId = new Map<string, Category>();
    for (const snapshot of [...owned.docs, ...shared.docs]) {
      const record = toCategoryRecord(snapshot.id, snapshot.data());
      const access = accessOf(record, this.uid);
      if (!access || record.isSensitive || byId.has(record.id)) continue;
      byId.set(record.id, toCategory(record, access));
    }
    return [...byId.values()].sort((a, b) => a.order - b.order);
  }

  async loadCategoryForUser(categoryId: string, need: Need = 'read'): Promise<Category> {
    if (!isDocId(categoryId)) throw new NotFoundError();
    const snapshot = await this.#db.collection(CATEGORIES).doc(categoryId).get();
    if (!snapshot.exists) throw new NotFoundError();

    const record = toCategoryRecord(snapshot.id, snapshot.data() ?? {});
    const access = accessOf(record, this.uid);
    if (!access || record.isSensitive) throw new NotFoundError();
    if (!satisfies(access, need)) throw new ForbiddenError();
    return toCategory(record, access);
  }

  // -------------------------------------------------------------------------
  // פתקים
  // -------------------------------------------------------------------------

  async listAccessibleNotes(options: ListNotesOptions = {}): Promise<Note[]> {
    const archived = options.archived ?? false;
    const notes = this.#db.collection(NOTES);

    // בלי אינדקסים מורכבים: שתי שאילתות שוויון וסינון בזיכרון (mcp-plan §8.2)
    const snapshots = archived
      ? (await notes.where('userId', '==', this.uid).get()).docs
      : (
          await Promise.all([
            notes.where('userId', '==', this.uid).get(),
            notes.where('sharedWith', 'array-contains', this.uid).get(),
          ])
        ).flatMap((result) => result.docs);

    const records = new Map<string, NoteRecord>();
    for (const snapshot of snapshots) {
      const record = toNoteRecord(snapshot.id, snapshot.data());
      if (record.isArchived === archived) records.set(record.id, record);
    }
    return this.#visibleNotes([...records.values()]);
  }

  /**
   * פתק לפי מזהה. `NotFoundError` זהה כשהפתק לא קיים, לא נגיש או רגיש.
   * `ForbiddenError` רק כשהפתק גלוי למשתמש והפעולה דורשת יותר (שותף מול `'owner'`).
   */
  async loadNoteForUser(noteId: string, need: Need = 'read'): Promise<Note> {
    if (!isDocId(noteId)) throw new NotFoundError();
    const snapshot = await this.#db.collection(NOTES).doc(noteId).get();
    if (!snapshot.exists) throw new NotFoundError();

    const [note] = await this.#visibleNotes([toNoteRecord(snapshot.id, snapshot.data() ?? {})]);
    if (!note) throw new NotFoundError();
    if (!satisfies(note.access, need)) throw new ForbiddenError();
    return note;
  }

  /** חיפוש בטקסט המרונדר של הפתקים הנגישים והגלויים בלבד */
  async searchNotes(query: string, options: SearchOptions = {}): Promise<SearchHit<Note>[]> {
    const active = await this.listAccessibleNotes();
    const archived = options.includeArchived ? await this.listAccessibleNotes({ archived: true }) : [];
    return searchNotes([...active, ...archived], query);
  }

  /**
   * גרסאות קודמות של פתק, מהחדשה לישנה.
   *
   * עובר קודם דרך `loadNoteForUser`, כך שפתק זר או רגיש מחזיר `NotFound`
   * עוד לפני שהגרסאות נקראות, והרגישות נקבעת לפי הפתק הנוכחי (§3.4).
   * לעולם לא שאילתת collection group על `versions` - היא עוקפת את הבדיקה.
   */
  async listVersionsForNote(noteId: string): Promise<NoteVersion[]> {
    const note = await this.loadNoteForUser(noteId, 'read');
    const versions = await this.#db
      .collection(NOTES)
      .doc(note.id)
      .collection(VERSIONS)
      .orderBy('capturedAt', 'desc')
      .limit(MAX_VERSIONS)
      .get();
    return versions.docs.map((snapshot) => toNoteVersion(snapshot.id, snapshot.data()));
  }

  // -------------------------------------------------------------------------
  // כתיבה (mcp-plan שלב 2א: יצירה בלבד)
  // -------------------------------------------------------------------------

  /**
   * פתק חדש בקטגוריה של המשתמש.
   *
   * הכל ב-transaction אחד:
   * - **הקטגוריה:** בבעלות המשתמש, גלויה (לא רגישה) ולא לקריאה בלבד.
   *   קטגוריה שלא קיימת, של משתמש אחר (גם משותפת) או רגישה - `NotFound`,
   *   כמו כל קריאה. קטגוריה לקריאה בלבד - `ReadOnlyError`: היא גלויה ממילא.
   * - **כפילויות:** אותו פתק (`draft.fingerprint`) מאותו משתמש בתוך 10
   *   דקות מחזיר את הקיים במקום ליצור שני. ראו `mcp/createNote.ts`.
   * - **audit:** רשומה ב-`auditLog`. נכשלה - הפתק לא נוצר.
   */
  async createNote(draft: NoteDraft, actor: Omit<WriteActor, 'uid'>, now: number): Promise<CreateNoteResult> {
    if (!isDocId(draft.categoryId)) throw new NotFoundError();
    const categoryRef = this.#db.collection(CATEGORIES).doc(draft.categoryId);
    const keyRef = this.#db
      .collection(IDEMPOTENCY)
      .doc(createHash('sha256').update(`${this.uid}\n${draft.fingerprint}`).digest('hex'));

    return this.#db.runTransaction(async (tx) => {
      // כל הקריאות לפני כל הכתיבות
      const [categorySnapshot, keySnapshot] = await Promise.all([tx.get(categoryRef), tx.get(keyRef)]);
      const siblings = await tx.get(
        this.#db.collection(NOTES).where('userId', '==', this.uid).where('categoryId', '==', draft.categoryId)
      );

      if (!categorySnapshot.exists) throw new NotFoundError();
      const category = toCategoryRecord(categorySnapshot.id, categorySnapshot.data() ?? {});
      if (category.userId !== this.uid || category.isSensitive) throw new NotFoundError();
      if (category.isReadOnly) throw new ReadOnlyError('The category is read-only for Claude');

      const key = keySnapshot.data();
      const existingId = typeof key?.noteId === 'string' ? key.noteId : null;
      const keyExpiresAt = (key?.expiresAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (existingId && keyExpiresAt > now) {
        // הפתק הקיים חייב עדיין להיות שם, פעיל: אם נמחק או אורכב, יוצרים חדש
        const existing = siblings.docs.find((doc) => doc.id === existingId && doc.get('isArchived') !== true);
        if (existing) {
          const record = toNoteRecord(existing.id, existing.data());
          return { note: toNote(record, 'owner', record.isReadOnly), categoryName: category.name, duplicate: true };
        }
      }

      const noteRef = this.#db.collection(NOTES).doc();
      const order = siblings.docs.reduce((max, doc) => Math.max(max, Number(doc.get('order')) || 0), -1) + 1;
      const stamp = Timestamp.fromMillis(now);
      const data = {
        title: draft.title,
        content: draft.content,
        categoryId: draft.categoryId,
        templateType: draft.templateType,
        tags: [],
        color: null,
        order,
        userId: this.uid,
        sharedWith: [],
        isPinned: false,
        isArchived: false,
        isSensitive: false,
        isReadOnly: false,
        createdVia: 'mcp',
        createdAt: stamp,
        updatedAt: stamp,
        updatedBy: this.uid,
      };

      tx.create(noteRef, data);
      tx.set(keyRef, { uid: this.uid, noteId: noteRef.id, expiresAt: Timestamp.fromMillis(now + DUPLICATE_WINDOW_MS) });
      tx.create(this.#db.collection(AUDIT).doc(), {
        ...noteCreatedEntry({ ...actor, uid: this.uid }, noteRef.id, { ...draft.summary, categoryName: category.name }),
        at: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + AUDIT_RETENTION_MS),
      });

      const record = toNoteRecord(noteRef.id, data);
      return { note: toNote(record, 'owner', false), categoryName: category.name, duplicate: false };
    });
  }

  /**
   * עריכה של פתק קיים, על הגרסה העדכנית, ב-transaction אחד (שלב 2ב-lite).
   *
   * לפי הסדר:
   * - לא קיים, זר, רגיש (או קטגוריה רגישה/חסרה) - `NotFound`, כמו כל קריאה.
   * - לא בבעלות המשתמש (שותף) - `Forbidden`: בינתיים רק פתקים שלו.
   * - קריאה בלבד ל-Claude (הפתק או הקטגוריה) - `ReadOnlyError`.
   * - מאורכב - `InvalidError`.
   * - פתוח באפליקציה (סימון נוכחות מהדקה האחרונה) - `OpenElsewhereError`,
   *   ולא כותבים. זו שכבת נוחות: גם בלעדיה העורך הפתוח לא דורס (C-1).
   * - בקשה זהה בחלון של 10 דקות - מוחזר מה שכבר נעשה.
   *
   * הכתיבה: התוכן, `revision + 1` (כל עורך פתוח מזהה אותה, וכל שמירה ישנה
   * שלו תידחה ע"י ה-rules), ו-`updatedBy: mcp:<clientId>:<edit>` - כותב אחר
   * בכל עריכה, ולכן היסטוריית הגרסאות שומרת את המצב שלפני כל עריכה של Claude. רשומת audit באותו transaction.
   */
  async editNote(
    noteId: string,
    edit: NoteEdit,
    actor: Omit<WriteActor, 'uid'>,
    now: number
  ): Promise<EditNoteResult> {
    if (!isDocId(noteId)) throw new NotFoundError();
    const noteRef = this.#db.collection(NOTES).doc(noteId);
    const keyRef = edit.fingerprint
      ? this.#db
          .collection(IDEMPOTENCY)
          .doc(createHash('sha256').update(`${this.uid}\n${noteId}\n${edit.fingerprint}`).digest('hex'))
      : null;

    return this.#db.runTransaction(async (tx) => {
      const snapshot = await tx.get(noteRef);
      if (!snapshot.exists) throw new NotFoundError();
      const record = toNoteRecord(snapshot.id, snapshot.data() ?? {});

      const [categorySnapshot, presence, key] = await Promise.all([
        isDocId(record.categoryId) ? tx.get(this.#db.collection(CATEGORIES).doc(record.categoryId)) : null,
        tx.get(noteRef.collection('presence')),
        keyRef ? tx.get(keyRef) : null,
      ]);

      const categories = new Map<string, CategoryRecord>();
      if (categorySnapshot?.exists) {
        categories.set(categorySnapshot.id, toCategoryRecord(categorySnapshot.id, categorySnapshot.data() ?? {}));
      }
      const access = accessOf(record, this.uid);
      if (!access || !isVisibleToMcp(record, categories)) throw new NotFoundError();
      if (access !== 'owner') throw new ForbiddenError("Only the user's own notes can be changed for now");
      if (isReadOnlyForMcp(record, categories)) throw new ReadOnlyError('The note is read-only for Claude');
      if ((edit.archived ?? 'active') === 'active' && record.isArchived) {
        throw new InvalidError('the note is archived. Restore it with unarchive_note first, if the user wants');
      }

      const openOn = presence.docs
        .filter((marker) => {
          const refreshedAt = marker.get('refreshedAt') as Timestamp | undefined;
          return refreshedAt instanceof Timestamp && now - refreshedAt.toMillis() < PRESENCE_TTL_MS;
        })
        .map((marker) => String(marker.get('device') ?? ''));
      if (openOn.length > 0) throw new OpenElsewhereError(openOn);

      // קריאות נוספות, לפני כל הכתיבות
      const [targetSnapshot, reminders] = await Promise.all([
        edit.targetCategoryId && isDocId(edit.targetCategoryId)
          ? tx.get(this.#db.collection(CATEGORIES).doc(edit.targetCategoryId))
          : null,
        tx.get(this.#db.collection(REMINDERS).where('noteId', '==', noteId)),
      ]);
      const targetCategory = targetSnapshot?.exists
        ? toCategoryRecord(targetSnapshot.id, targetSnapshot.data() ?? {})
        : null;

      const current = toNote(record, 'owner', false);
      const keyData = key?.data();
      if (keyData?.noteId === noteId && ((keyData.expiresAt as Timestamp | undefined)?.toMillis() ?? 0) > now) {
        return { note: current, changed: false, duplicate: true };
      }

      const outcome = edit.apply(record, { targetCategory });
      if (!outcome) return { note: current, changed: false, duplicate: false };

      const revision = record.revision + 1;
      const stamp = Timestamp.fromMillis(now);
      const fields: Record<string, unknown> = { ...outcome.fields };
      if (outcome.fields?.isArchived === true) fields.archivedAt = stamp;
      if (outcome.fields?.isArchived === false) fields.archivedAt = null;
      tx.update(noteRef, {
        ...(outcome.content !== undefined && { content: outcome.content }),
        ...fields,
        revision,
        updatedAt: stamp,
        // מזהה ייחודי לכל עריכה: כל עריכה של Claude היא "כותב אחר", ולכן
        // היסטוריית הגרסאות שומרת את המצב שלפני **כל** אחת מהן (ולא רק
        // שלפני הראשונה בחלון של 10 דקות). ההיסטוריה מציגה כל `mcp:` כ-"Claude"
        updatedBy: `mcp:${actor.clientId}:${randomUUID().slice(0, 8)}`,
      });
      if (keyRef) {
        tx.set(keyRef, { uid: this.uid, noteId, expiresAt: Timestamp.fromMillis(now + DUPLICATE_WINDOW_MS) });
      }
      const change = outcome.reminders;
      for (const reminder of reminders.docs) {
        if (change?.kind === 'deleteAll') tx.delete(reminder.ref);
        else if (change?.kind === 'deleteItems' && change.itemIds.includes(String(reminder.get('itemId')))) tx.delete(reminder.ref);
        else if (change?.kind === 'setCategory') tx.update(reminder.ref, { categoryId: change.categoryId });
      }
      tx.create(this.#db.collection(AUDIT).doc(), {
        ...noteEditedEntry(
          { ...actor, uid: this.uid },
          noteId,
          edit.action,
          {
            title: record.title,
            templateType: record.templateType,
            // אחרי העברה - הקטגוריה החדשה, כדי שהקישור ב"פעילות Claude" יוביל לפתק
            categoryId: outcome.fields?.categoryId ?? record.categoryId,
            description: outcome.description,
            revisionBefore: record.revision,
            revisionAfter: revision,
          },
          { before: outcome.before, after: outcome.after }
        ),
        at: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + AUDIT_RETENTION_MS),
      });

      return {
        note: toNote(
          { ...record, ...outcome.fields, content: outcome.content ?? record.content, revision },
          'owner',
          false
        ),
        changed: true,
        duplicate: false,
      };
    });
  }

  // -------------------------------------------------------------------------
  // פנימי
  // -------------------------------------------------------------------------

  /**
   * מסנן לפי גישה ולפי `isVisibleToMcp`. הקטגוריות נטענות לפי מזהה
   * (Admin), כלומר הקטגוריה של הבעלים גם כשהיא לא משותפת עם המבקש.
   * שומר על הסדר של הקלט ואז ממיין.
   */
  async #visibleNotes(records: NoteRecord[]): Promise<Note[]> {
    const categoriesById = await this.#categoriesById(records.map((record) => record.categoryId));
    return records
      .flatMap((record) => {
        const access = accessOf(record, this.uid);
        return access && isVisibleToMcp(record, categoriesById)
          ? [toNote(record, access, isReadOnlyForMcp(record, categoriesById))]
          : [];
      })
      .sort(byPinnedThenOrder);
  }

  /**
   * הקטגוריות לפי מזהה. מזהה ריק או שבור, וקטגוריה שנמחקה, פשוט חסרים
   * במפה - ו-`isVisibleToMcp` מסתיר את הפתק שלהם.
   */
  async #categoriesById(ids: string[]): Promise<Map<string, CategoryRecord>> {
    const unique = [...new Set(ids.filter(isDocId))];
    if (unique.length === 0) return new Map();

    const categories = this.#db.collection(CATEGORIES);
    const snapshots: DocumentSnapshot[] = await this.#db.getAll(...unique.map((id) => categories.doc(id)));
    return new Map(
      snapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [snapshot.id, toCategoryRecord(snapshot.id, snapshot.data() ?? {})])
    );
  }
}
