/**
 * בקשות גישה ל-Claude ואישור שלהן ע"י מנהל (v1.43.0).
 *
 * עד עכשיו כל משתמש חדש נוסף ידנית ל-`config/mcp.allowedUids` ב-console.
 * עכשיו:
 * - משתמש שלא מורשה מבקש גישה ממסך ההסכמה (`/connect`). בקשה אחת לכל
 *   משתמש (המסמך הוא `mcpAccessRequests/{uid}`), עם הגבלת קצב.
 * - המנהלים (`config/mcp.adminUids`, נקבע ידנית ב-console) מקבלים push.
 * - מנהל מאשר, דוחה או מבטל מתוך ההגדרות. כל פעולה נרשמת ב-`mcpAccessAudit`.
 *
 * ההרשאות:
 * - **מנהל = uid ב-`adminUids`**, ונבדק בשרת בלבד, בתוך ה-transaction של
 *   כל פעולה (ולא רק לפניה). ה-rules סוגרים את `config/mcp` לאפליקציה.
 * - אישור וביטול נוגעים **רק** ב-`allowedUids`, ב-`arrayUnion`/`arrayRemove`:
 *   לא ב-`openToAll`, לא ב-`adminUids`, ואישורים מקבילים לא דורסים זה את זה.
 * - ביטול מוציא מהרשימה **וגם** מבטל מיד את כל החיבורים וה-tokens של המשתמש.
 *   ההוצאה מהרשימה כבר חוסמת (האימות לא שומר cache), אבל ביטול החיבורים
 *   חוסם גם כש-`openToAll` פתוח, ומונע מחיבור ישן לחזור לחיים באישור הבא.
 *
 * הזהות: Firebase ID token ב-header, כמו `/oauth/decision`. השם והאימייל
 * בבקשה נלקחים מה-token המאומת, לא ממה שהלקוח שולח.
 */

import type { Auth } from 'firebase-admin/auth';
import { firebaseUser } from './decision';
import { OAuthError, tooManyRequests } from './errors';
import { isUserAllowed } from './policy';
import type { AccessConfig, AccessRequestRecord, AccessRequestStatus, OAuthStore } from './store';
import type { RateLimitWindow } from './config';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * בקשות גישה למשתמש. בקשה שממתינה לא נספרת (לחיצה חוזרת לא יוצרת כלום),
 * כך שזה חוסם רק בקשה-דחייה-בקשה בלולאה, וכל אחת מהן היא push למנהל.
 */
export const ACCESS_REQUEST_LIMITS: readonly RateLimitWindow[] = [
  { name: 'minute', windowMs: MINUTE, max: 1 },
  { name: 'day', windowMs: DAY, max: 3 },
];

export const isAdmin = (config: AccessConfig, uid: string): boolean => config.adminUids.includes(uid);

/** אותה תשובה לכל מי שאינו מנהל, בלי לגלות מי כן */
const notAdmin = () => new OAuthError('access_denied', 'Not allowed', 403);
const notFound = () => new OAuthError('invalid_request', 'Request not found', 404);

/** מזהה משתמש של Firebase: מחרוזת קצרה בלי `/` (גם מזהה מסמך) */
const isUid = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');

const targetUid = (body: unknown): string => {
  const uid = typeof body === 'object' && body !== null ? (body as { uid?: unknown }).uid : undefined;
  if (!isUid(uid)) throw notFound();
  return uid;
};

// ---------------------------------------------------------------------------
// המשתמש
// ---------------------------------------------------------------------------

export interface AccessStatus {
  allowed: boolean;
  /** הבקשה האחרונה של המשתמש, אם יש */
  request: AccessRequestStatus | null;
  /** רק כדי להציג את מסך המנהל. כל פעולת מנהל נבדקת שוב בשרת */
  admin: boolean;
}

const statusOf = (config: AccessConfig, uid: string, request: AccessRequestStatus | null): AccessStatus => ({
  allowed: isUserAllowed(config, uid),
  request,
  admin: isAdmin(config, uid),
});

const statusFor = async (store: OAuthStore, uid: string): Promise<AccessStatus> => {
  const [config, request] = await Promise.all([store.getAccessConfig(), store.getAccessRequest(uid)]);
  return statusOf(config, uid, request?.status ?? null);
};

export const accessStatus = async ({
  store,
  auth,
  authorization,
}: {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
}): Promise<AccessStatus> => statusFor(store, (await firebaseUser(auth, authorization)).uid);

export interface AdminNotice {
  adminUids: string[];
  name: string;
  email: string;
}

/**
 * בקשת גישה. מחזירה את המצב אחרי הבקשה. `notify` נקרא רק כשנוצרה בקשה
 * חדשה (לא בלחיצה חוזרת על בקשה שממתינה), וכשל בו לא מכשיל את הבקשה.
 */
export const requestAccess = async ({
  store,
  auth,
  authorization,
  now,
  limits = ACCESS_REQUEST_LIMITS,
  notify,
}: {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
  now: number;
  limits?: readonly RateLimitWindow[];
  notify: (notice: AdminNotice) => Promise<void>;
}): Promise<AccessStatus> => {
  const decoded = await firebaseUser(auth, authorization);
  const { uid } = decoded;
  const email = typeof decoded.email === 'string' ? decoded.email : '';
  const name = typeof decoded.name === 'string' && decoded.name.trim() ? decoded.name.trim() : email;

  // בלי הגבלה: כבר מורשה, או שבקשה כבר ממתינה - אין מה ליצור
  const before = await statusFor(store, uid);
  if (before.allowed || before.request === 'pending') return before;

  const limit = await store.consumeRateLimit(`access_request_${uid}`, limits, now);
  if (!limit.allowed) throw tooManyRequests(limit.retryAfterMs);

  // ב-transaction: שתי לחיצות במקביל יוצרות בקשה אחת והתראה אחת
  const outcome = await store.run(async (tx) => {
    const config = await tx.getAccessConfig();
    const existing = await tx.getAccessRequest(uid);
    if (isUserAllowed(config, uid) || existing?.status === 'pending') {
      return { created: false, config, request: existing?.status ?? null };
    }
    const record: AccessRequestRecord = {
      uid,
      name: name.slice(0, 200),
      email: email.slice(0, 320),
      status: 'pending',
      requestedAt: now,
      decidedAt: null,
      decidedBy: null,
    };
    tx.setAccessRequest(record);
    return { created: true, config, request: 'pending' as const };
  });

  if (outcome.created && outcome.config.adminUids.length > 0) {
    try {
      await notify({ adminUids: outcome.config.adminUids, name, email });
    } catch {
      // ההתראה היא נוחות: הבקשה כבר שמורה ותופיע במסך המנהל
    }
  }

  return statusOf(outcome.config, uid, outcome.request);
};

// ---------------------------------------------------------------------------
// המנהל
// ---------------------------------------------------------------------------

export interface AccessUser {
  uid: string;
  name: string;
  email: string;
}

export interface AdminView {
  pending: (AccessUser & { requestedAt: string })[];
  approved: AccessUser[];
  /** `openToAll` פתוח: הרשימה לא קובעת מי נכנס. מוצג למנהל, ולא משתנה מכאן */
  openToAll: boolean;
}

const requireAdmin = async (store: OAuthStore, auth: Auth, authorization: unknown): Promise<string> => {
  const { uid } = await firebaseUser(auth, authorization);
  if (!isAdmin(await store.getAccessConfig(), uid)) throw notAdmin();
  return uid;
};

/** שם ואימייל מ-Firebase Auth. משתמש שנמחק - רק המזהה */
const describeUsers = async (auth: Auth, uids: string[]): Promise<Map<string, AccessUser>> => {
  const found = new Map<string, AccessUser>();
  for (let index = 0; index < uids.length; index += 100) {
    const { users } = await auth.getUsers(uids.slice(index, index + 100).map((uid) => ({ uid })));
    for (const user of users) {
      found.set(user.uid, { uid: user.uid, name: user.displayName ?? user.email ?? '', email: user.email ?? '' });
    }
  }
  return found;
};

export const adminView = async ({
  store,
  auth,
  authorization,
}: {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
}): Promise<AdminView> => {
  await requireAdmin(store, auth, authorization);
  const [config, pending] = await Promise.all([store.getAccessConfig(), store.listPendingAccessRequests()]);
  const known = await describeUsers(auth, config.allowedUids);
  return {
    pending: pending.map((request) => ({
      uid: request.uid,
      name: request.name,
      email: request.email,
      requestedAt: new Date(request.requestedAt).toISOString(),
    })),
    approved: config.allowedUids.map((uid) => known.get(uid) ?? { uid, name: '', email: '' }),
    openToAll: config.openToAll,
  };
};

interface AdminActionInput {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
  body: unknown;
  now: number;
}

/**
 * אישור או דחייה של בקשה שממתינה. המנהל נבדק שוב בתוך ה-transaction, מול
 * אותה קריאה של `config/mcp` שממנה נגזרת הכתיבה.
 */
const decideRequest = async (action: 'approve' | 'reject', input: AdminActionInput): Promise<{ uid: string }> => {
  const { store, auth, authorization, body, now } = input;
  const adminUid = await requireAdmin(store, auth, authorization);
  const uid = targetUid(body);

  await store.run(async (tx) => {
    const config = await tx.getAccessConfig();
    const request = await tx.getAccessRequest(uid);
    if (!isAdmin(config, adminUid)) throw notAdmin();
    if (request?.status !== 'pending') throw notFound();

    if (action === 'approve') tx.allowUid(uid);
    tx.updateAccessRequest(uid, {
      status: action === 'approve' ? 'approved' : 'rejected',
      decidedAt: now,
      decidedBy: adminUid,
    });
    tx.addAccessAudit({ action, adminUid, targetUid: uid, targetEmail: request.email, at: now });
  });
  return { uid };
};

export const approveAccess = (input: AdminActionInput) => decideRequest('approve', input);
export const rejectAccess = (input: AdminActionInput) => decideRequest('reject', input);

/**
 * ביטול גישה: הוצאה מ-`allowedUids` ורישום ביומן ב-transaction, ואז ביטול
 * כל החיבורים וה-tokens של המשתמש. מחזיר כמה חיבורים בוטלו.
 */
export const revokeAccess = async (input: AdminActionInput): Promise<{ uid: string; grantsRevoked: number }> => {
  const { store, auth, authorization, body, now } = input;
  const adminUid = await requireAdmin(store, auth, authorization);
  const uid = targetUid(body);
  const email = (await describeUsers(auth, [uid])).get(uid)?.email ?? '';

  await store.run(async (tx) => {
    const config = await tx.getAccessConfig();
    const request = await tx.getAccessRequest(uid);
    if (!isAdmin(config, adminUid)) throw notAdmin();
    if (!config.allowedUids.includes(uid)) throw notFound();

    tx.disallowUid(uid);
    if (request) tx.updateAccessRequest(uid, { status: 'revoked', decidedAt: now, decidedBy: adminUid });
    tx.addAccessAudit({ action: 'revoke', adminUid, targetUid: uid, targetEmail: email || (request?.email ?? ''), at: now });
  });

  // אחרי שהמשתמש כבר לא ברשימה: גם חיבור שנוצר בדיוק עכשיו לא יעבור אימות
  const grantIds = await store.listActiveGrantIds(uid);
  for (const grantId of grantIds) {
    await store.run(async (tx) => {
      tx.revokeGrant(grantId, 'revoked_by_admin');
    });
    await store.revokeGrantTokens(grantId);
  }
  return { uid, grantsRevoked: grantIds.length };
};

