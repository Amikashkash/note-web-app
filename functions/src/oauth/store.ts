/**
 * הגישה של ה-Authorization Server ל-Firestore (mcp-plan §2.3, "מבנה Firestore ל-OAuth").
 *
 * הקובץ היחיד ב-`oauth/` שמייבא את Firestore (ESLint). שאר הקבצים עובדים
 * עם הטיפוסים כאן, שבהם זמנים הם מילישניות. ההמרה ל-Timestamp נעשית
 * כאן, כי ה-TTL של Firestore עובד רק על שדות Timestamp (`expiresAt`).
 *
 * כל המסמכים נכתבים רק מכאן (Admin SDK). ה-rules חוסמים את כולם ללקוח,
 * חוץ מקריאה של `oauthGrants` לבעלים (§8.1).
 *
 * מה נשמר ואיך:
 * - `oauthTokens/{sha256}`, `oauthCodes/{sha256}`: המפתח הוא hash של הערך,
 *   והערך עצמו לא נשמר בשום מקום.
 * - `oauthRequests/{reqId}`: ה-nonce של ההסכמה נשמר כ-hash בלבד.
 * - `mcpAccessRequests/{uid}`: בקשת גישה של משתמש (v1.43.0). המזהה הוא ה-uid,
 *   ולכן יש לכל משתמש בקשה אחת לכל היותר.
 * - `mcpAccessAudit/{auto}`: כל אישור, דחייה וביטול של מנהל.
 */

import { FieldValue, getFirestore, Timestamp, type DocumentData, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { RateLimitWindow } from './config';

const COLLECTIONS = {
  clients: 'oauthClients',
  requests: 'oauthRequests',
  codes: 'oauthCodes',
  grants: 'oauthGrants',
  tokens: 'oauthTokens',
  rateLimits: 'rateLimits',
  accessRequests: 'mcpAccessRequests',
  accessAudit: 'mcpAccessAudit',
} as const;

const CONFIG_DOC = 'config/mcp';

export interface ClientRecord {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  source: 'dcr';
  createdAt: number;
  /** נמחק (TTL) אם לא הונפק token עד אז. `null` אחרי ה-token הראשון */
  expiresAt: number | null;
}

export type RequestStatus = 'pending' | 'approved' | 'denied';

export interface RequestRecord {
  reqId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  state: string | null;
  status: RequestStatus;
  /** המשתמש שפתח את מסך ההסכמה. נקבע פעם אחת ולא משתנה */
  uid: string | null;
  /** hash של ה-nonce שהוחזר למסך ההסכמה. ההחלטה חייבת להציג אותו */
  nonceHash: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface CodeRecord {
  uid: string;
  clientId: string;
  grantId: string;
  /** גרסת נוסח ההסכמה שאושר (`CONSENT_VERSION`). חסר = 1 */
  consentVersion?: number;
  codeChallenge: string;
  redirectUri: string;
  resource: string;
  scope: string;
  used: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface GrantRecord {
  grantId: string;
  uid: string;
  clientId: string;
  /** גרסת נוסח ההסכמה שאושר. חסר (חיבור מלפני v1.26) = 1 */
  consentVersion?: number;
  clientName: string;
  scope: string;
  createdAt: number;
  lastUsedAt: number;
  /** תקרה מוחלטת (90 יום), גם עם refresh */
  absoluteExpiresAt: number;
  revoked: boolean;
  revokedReason: string | null;
}

export type TokenType = 'access' | 'refresh';

export interface TokenRecord {
  type: TokenType;
  grantId: string;
  uid: string;
  clientId: string;
  scope: string;
  resource: string;
  createdAt: number;
  expiresAt: number;
  /** refresh token שכבר הוחלף. הצגה חוזרת שלו = גניבה (reuse detection) */
  used: boolean;
  revoked: boolean;
}

/** `config/mcp` (§2.3.5). חסר, ריק או פגום = אף אחד לא מורשה */
export interface AccessConfig {
  allowedUids: string[];
  openToAll: boolean;
  /**
   * מי מאשר בקשות גישה (v1.43.0). נקבע ידנית ב-console ולא משתנה מהקוד.
   * רק הבדיקה בשרת מול הרשימה הזו נותנת הרשאות מנהל.
   */
  adminUids: string[];
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

/** `mcpAccessRequests/{uid}`. השם והאימייל מה-ID token המאומת, לא מהלקוח */
export interface AccessRequestRecord {
  uid: string;
  name: string;
  email: string;
  status: AccessRequestStatus;
  requestedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
}

export type AccessAuditAction = 'approve' | 'reject' | 'revoke';

export interface AccessAuditEntry {
  action: AccessAuditAction;
  adminUid: string;
  targetUid: string;
  /** לקריאה של היומן בלי לחפש את המשתמש. מהבקשה או מ-Firebase Auth */
  targetEmail: string;
  at: number;
}

// ---------------------------------------------------------------------------
// המרה בין מילישניות ל-Timestamp
// ---------------------------------------------------------------------------

const TIME_FIELDS = ['createdAt', 'expiresAt', 'lastUsedAt', 'absoluteExpiresAt'] as const;

const toStored = (record: object): DocumentData => {
  const data: DocumentData = { ...record };
  for (const field of TIME_FIELDS) {
    if (typeof data[field] === 'number') data[field] = Timestamp.fromMillis(data[field]);
  }
  return data;
};

const fromStored = <T>(data: DocumentData | undefined): T | null => {
  if (!data) return null;
  const record: DocumentData = { ...data };
  for (const field of TIME_FIELDS) {
    if (record[field] instanceof Timestamp) record[field] = record[field].toMillis();
    else if (record[field] === undefined) record[field] = null;
  }
  return record as T;
};

/**
 * בקשות גישה ויומן המנהל: זמנים משלהם. לא דרך `TIME_FIELDS`, כדי שרשומות
 * ה-OAuth הקיימות (grants, tokens) לא יקבלו שדות `null` חדשים בקריאה.
 */
const ACCESS_TIME_FIELDS = ['requestedAt', 'decidedAt', 'at'] as const;

const toStoredAccess = (record: object): DocumentData => {
  const data: DocumentData = { ...record };
  for (const field of ACCESS_TIME_FIELDS) {
    if (typeof data[field] === 'number') data[field] = Timestamp.fromMillis(data[field]);
  }
  return data;
};

const fromStoredRequest = (data: DocumentData | undefined): AccessRequestRecord | null => {
  if (!data || typeof data.uid !== 'string') return null;
  const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : null);
  return {
    uid: data.uid,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    status: ['pending', 'approved', 'rejected', 'revoked'].includes(data.status) ? data.status : 'pending',
    requestedAt: millis(data.requestedAt) ?? 0,
    decidedAt: millis(data.decidedAt),
    decidedBy: typeof data.decidedBy === 'string' ? data.decidedBy : null,
  };
};

const uidList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((uid): uid is string => typeof uid === 'string' && uid !== '') : [];

const readAccessConfig = (data: DocumentData | undefined): AccessConfig => ({
  allowedUids: uidList(data?.allowedUids),
  // רק `true` ממש. מחרוזת 'true' או כל ערך אחר לא פותחים את הגישה
  openToAll: data?.openToAll === true,
  adminUids: uidList(data?.adminUids),
});

// ---------------------------------------------------------------------------
// transaction
// ---------------------------------------------------------------------------

/**
 * הפעולות שמותרות בתוך transaction. כמו ב-Firestore: כל הקריאות לפני
 * כל הכתיבות.
 */
export class OAuthTransaction {
  readonly #db: Firestore;
  readonly #tx: Transaction;

  constructor(db: Firestore, tx: Transaction) {
    this.#db = db;
    this.#tx = tx;
  }

  #doc(collection: string, id: string) {
    return this.#db.collection(collection).doc(id);
  }

  async #get<T>(collection: string, id: string): Promise<T | null> {
    return fromStored<T>((await this.#tx.get(this.#doc(collection, id))).data());
  }

  getClient = (clientId: string) => this.#get<ClientRecord>(COLLECTIONS.clients, clientId);
  getRequest = (reqId: string) => this.#get<RequestRecord>(COLLECTIONS.requests, reqId);
  getCode = (codeHash: string) => this.#get<CodeRecord>(COLLECTIONS.codes, codeHash);
  getGrant = (grantId: string) => this.#get<GrantRecord>(COLLECTIONS.grants, grantId);
  getToken = (tokenHash: string) => this.#get<TokenRecord>(COLLECTIONS.tokens, tokenHash);

  async getAccessConfig(): Promise<AccessConfig> {
    return readAccessConfig((await this.#tx.get(this.#db.doc(CONFIG_DOC))).data());
  }

  updateRequest(reqId: string, patch: Partial<RequestRecord>): void {
    this.#tx.update(this.#doc(COLLECTIONS.requests, reqId), toStored(patch));
  }

  setCode(codeHash: string, record: CodeRecord): void {
    this.#tx.create(this.#doc(COLLECTIONS.codes, codeHash), toStored(record));
  }

  markCodeUsed(codeHash: string): void {
    this.#tx.update(this.#doc(COLLECTIONS.codes, codeHash), { used: true });
  }

  createGrant(record: GrantRecord): void {
    this.#tx.create(this.#doc(COLLECTIONS.grants, record.grantId), toStored(record));
  }

  touchGrant(grantId: string, now: number): void {
    this.#tx.update(this.#doc(COLLECTIONS.grants, grantId), { lastUsedAt: Timestamp.fromMillis(now) });
  }

  /**
   * ביטול grant. `set` עם merge ולא `update`: code שנוצל פעמיים לפני
   * שה-grant נוצר מבטל grant שעוד לא קיים, וה-tombstone מונע יצירה שלו.
   */
  revokeGrant(grantId: string, reason: string): void {
    this.#tx.set(this.#doc(COLLECTIONS.grants, grantId), { revoked: true, revokedReason: reason }, { merge: true });
  }

  createToken(tokenHash: string, record: TokenRecord): void {
    this.#tx.create(this.#doc(COLLECTIONS.tokens, tokenHash), toStored(record));
  }

  updateToken(tokenHash: string, patch: Partial<Pick<TokenRecord, 'used' | 'revoked'>>): void {
    this.#tx.update(this.#doc(COLLECTIONS.tokens, tokenHash), patch);
  }

  /** לקוח שהונפק לו token לא נמחק יותר ע"י ה-TTL */
  markClientUsed(clientId: string): void {
    this.#tx.update(this.#doc(COLLECTIONS.clients, clientId), { expiresAt: FieldValue.delete() });
  }

  // --- בקשות גישה (v1.43.0) ---

  async getAccessRequest(uid: string): Promise<AccessRequestRecord | null> {
    return fromStoredRequest((await this.#tx.get(this.#doc(COLLECTIONS.accessRequests, uid))).data());
  }

  setAccessRequest(record: AccessRequestRecord): void {
    this.#tx.set(this.#doc(COLLECTIONS.accessRequests, record.uid), toStoredAccess(record));
  }

  updateAccessRequest(uid: string, patch: Partial<AccessRequestRecord>): void {
    this.#tx.update(this.#doc(COLLECTIONS.accessRequests, uid), toStoredAccess(patch));
  }

  /**
   * הוספה ל-`allowedUids` בלבד: `arrayUnion` על השדה הזה, בלי לגעת ב-`openToAll`
   * או ב-`adminUids`, ובלי לדרוס אישור מקביל של משתמש אחר.
   */
  allowUid(uid: string): void {
    this.#tx.update(this.#db.doc(CONFIG_DOC), { allowedUids: FieldValue.arrayUnion(uid) });
  }

  /** הסרה מ-`allowedUids` בלבד (`arrayRemove`), כמו `allowUid` */
  disallowUid(uid: string): void {
    this.#tx.update(this.#db.doc(CONFIG_DOC), { allowedUids: FieldValue.arrayRemove(uid) });
  }

  addAccessAudit(entry: AccessAuditEntry): void {
    this.#tx.create(this.#db.collection(COLLECTIONS.accessAudit).doc(), toStoredAccess(entry));
  }
}

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export class OAuthStore {
  readonly #db: Firestore;

  private constructor(db: Firestore) {
    this.#db = db;
  }

  /** `db` מוזרק רק בבדיקות (emulator) */
  static create(db: Firestore = getFirestore()): OAuthStore {
    return new OAuthStore(db);
  }

  run<T>(fn: (tx: OAuthTransaction) => Promise<T>): Promise<T> {
    return this.#db.runTransaction((tx) => fn(new OAuthTransaction(this.#db, tx)));
  }

  async createClient(record: ClientRecord): Promise<void> {
    await this.#db.collection(COLLECTIONS.clients).doc(record.clientId).create(toStored(record));
  }

  async getClient(clientId: string): Promise<ClientRecord | null> {
    return fromStored<ClientRecord>((await this.#db.collection(COLLECTIONS.clients).doc(clientId).get()).data());
  }

  async createRequest(record: RequestRecord): Promise<void> {
    await this.#db.collection(COLLECTIONS.requests).doc(record.reqId).create(toStored(record));
  }

  async getToken(tokenHash: string): Promise<TokenRecord | null> {
    return fromStored<TokenRecord>((await this.#db.collection(COLLECTIONS.tokens).doc(tokenHash).get()).data());
  }

  async getGrant(grantId: string): Promise<GrantRecord | null> {
    return fromStored<GrantRecord>((await this.#db.collection(COLLECTIONS.grants).doc(grantId).get()).data());
  }

  async getAccessConfig(): Promise<AccessConfig> {
    return readAccessConfig((await this.#db.doc(CONFIG_DOC).get()).data());
  }

  /** "שימוש אחרון" לרשימת האפליקציות המחוברות. מחוץ ל-transaction: לא קריטי */
  async touchGrant(grantId: string, now: number): Promise<void> {
    await this.#db.collection(COLLECTIONS.grants).doc(grantId).update({ lastUsedAt: Timestamp.fromMillis(now) });
  }

  /** בקשות הגישה שממתינות, מהישנה לחדשה */
  async listPendingAccessRequests(): Promise<AccessRequestRecord[]> {
    const snapshot = await this.#db.collection(COLLECTIONS.accessRequests).where('status', '==', 'pending').get();
    return snapshot.docs
      .map((doc) => fromStoredRequest(doc.data()))
      .filter((record): record is AccessRequestRecord => record !== null)
      .sort((a, b) => a.requestedAt - b.requestedAt);
  }

  async getAccessRequest(uid: string): Promise<AccessRequestRecord | null> {
    return fromStoredRequest((await this.#db.collection(COLLECTIONS.accessRequests).doc(uid).get()).data());
  }

  /**
   * החיבורים של משתמש שעוד לא בוטלו. שאילתת שוויון אחת (`uid`) וסינון
   * בזיכרון, בלי אינדקס מורכב. משתמש מחזיק חיבורים בודדים.
   */
  async listActiveGrantIds(uid: string): Promise<string[]> {
    const snapshot = await this.#db.collection(COLLECTIONS.grants).where('uid', '==', uid).get();
    return snapshot.docs.filter((doc) => doc.get('revoked') !== true).map((doc) => doc.id);
  }

  /** ה-tokens של התראות push של משתמש (`users/{uid}/fcmTokens`), עם הנתיב למחיקה */
  async getPushTokens(uid: string): Promise<{ token: string; path: string }[]> {
    const snapshot = await this.#db.collection('users').doc(uid).collection('fcmTokens').get();
    return snapshot.docs
      .map((doc) => ({ token: doc.get('token') as unknown, path: doc.ref.path }))
      .filter((entry): entry is { token: string; path: string } => typeof entry.token === 'string' && entry.token !== '');
  }

  async deletePushToken(path: string): Promise<void> {
    await this.#db.doc(path).delete();
  }

  /**
   * ביטול כל ה-tokens של grant. ה-grant המבוטל הוא הבדיקה הקובעת (כל
   * שימוש ב-token בודק אותו), ולכן זה ניקוי משלים, מחוץ ל-transaction.
   */
  async revokeGrantTokens(grantId: string): Promise<void> {
    const tokens = await this.#db.collection(COLLECTIONS.tokens).where('grantId', '==', grantId).get();
    if (tokens.empty) return;
    const batch = this.#db.batch();
    for (const token of tokens.docs) batch.update(token.ref, { revoked: true });
    await batch.commit();
  }

  /**
   * חלונות קבועים, ב-transaction כדי ששתי בקשות במקביל לא ייספרו כאחת.
   * אותו אלגוריתם כמו `consumeRateLimit` ב-`userLookup.ts`, עם חלונות
   * כפרמטר. ניסיון שנחסם לא נספר. המסמך נמחק ב-TTL (`expiresAt`).
   */
  consumeRateLimit(key: string, windows: readonly RateLimitWindow[], now: number): Promise<RateLimitResult> {
    const ref = this.#db.collection(COLLECTIONS.rateLimits).doc(key);
    const longest = Math.max(...windows.map((window) => window.windowMs));

    return this.#db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const stored = snapshot.exists ? (snapshot.data() ?? {}) : {};
      const next: Record<string, { start: number; count: number }> = {};

      for (const window of windows) {
        const current = stored[window.name] as { start: number; count: number } | undefined;
        const state = !current || now - current.start >= window.windowMs ? { start: now, count: 0 } : current;
        if (state.count >= window.max) {
          return { allowed: false, retryAfterMs: state.start + window.windowMs - now };
        }
        next[window.name] = { start: state.start, count: state.count + 1 };
      }

      tx.set(ref, { ...next, expiresAt: Timestamp.fromMillis(now + longest) });
      return { allowed: true } as const;
    });
  }
}
