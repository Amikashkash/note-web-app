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

import { getFirestore, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { ForbiddenError, NotFoundError } from './errors';
import { isVerifiedIdentity, type VerifiedIdentity } from './identity';
import { toCategoryRecord, toNoteRecord, toNoteVersion } from './mappers';
import type { Access, Category, CategoryRecord, Note, NoteRecord, NoteVersion } from './model';
import { LIMITS, accessOf, satisfies, type Need } from './permissions';
import { searchNotes, type SearchHit } from './search';
import { isVisibleToMcp } from './visibility';

const NOTES = 'notes';
const CATEGORIES = 'categories';
const VERSIONS = 'versions';

/** מספר הגרסאות המרבי שמוחזר - אותו סדר גודל כמו מה שהאפליקציה שומרת */
const MAX_VERSIONS = 50;

/**
 * מזהה שאפשר לבנות ממנו נתיב מסמך. מזהה אחר (ריק, עם `/`, ארוך מדי)
 * לא יכול להתאים לשום מסמך, ומטופל כמו מסמך שלא קיים.
 */
const isDocId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= LIMITS.id && !id.includes('/');

const withoutSensitive = <T extends { isSensitive: boolean }>({ isSensitive: _, ...rest }: T) => rest;

const toNote = (record: NoteRecord, access: Access): Note => ({ ...withoutSensitive(record), access });

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
        return access && isVisibleToMcp(record, categoriesById) ? [toNote(record, access)] : [];
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
