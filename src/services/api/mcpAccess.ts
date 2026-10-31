/**
 * בקשות גישה ל-Claude ומסך המנהל (v1.43.0), מול `/oauth/access/*` בפונקציית
 * `mcp` (`functions/src/oauth/access.ts`).
 *
 * הזהות ב-`Authorization: Bearer <Firebase ID token>`, כמו מסך ההסכמה.
 * האפליקציה לא קוראת את `config/mcp` (ה-rules סוגרים אותו): גם "האם אני
 * מנהל" מגיע מהשרת, וכל פעולת מנהל נבדקת שם שוב.
 */

import { auth } from '@/services/firebase/config';
import { logger } from '@/utils/logger';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface AccessStatus {
  allowed: boolean;
  request: AccessRequestStatus | null;
  admin: boolean;
}

export interface AccessUser {
  uid: string;
  name: string;
  email: string;
}

export interface AdminView {
  pending: (AccessUser & { requestedAt: string })[];
  approved: AccessUser[];
  openToAll: boolean;
}

/** שגיאה עם הודעה בעברית למשתמש */
export class AccessApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AccessApiError';
    this.status = status;
  }
}

const MESSAGES: Record<number, string> = {
  401: 'צריך להתחבר מחדש.',
  403: 'אין לך הרשאה לפעולה הזו.',
  404: 'הבקשה כבר טופלה, או שהמשתמש לא נמצא. רעננו ונסו שוב.',
  429: 'כבר נשלחה בקשה לפני רגע. נסו שוב מאוחר יותר.',
};

const call = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {
    idToken = undefined;
  }
  if (!idToken) throw new AccessApiError(401, MESSAGES[401]);

  let response: Response;
  try {
    response = await fetch(`/oauth/access${path}`, {
      method,
      headers: { Authorization: `Bearer ${idToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (error) {
    logger.error('Access API unreachable:', error);
    throw new AccessApiError(0, 'אין חיבור לשרת. נסו שוב.');
  }

  if (!response.ok) {
    logger.error('Access API failed with status', response.status);
    throw new AccessApiError(response.status, MESSAGES[response.status] ?? 'משהו השתבש. נסו שוב בעוד כמה דקות.');
  }
  return (await response.json()) as T;
};

export const getAccessStatus = () => call<AccessStatus>('GET', '/status');
export const requestAccess = () => call<AccessStatus>('POST', '/request', {});

export const getAdminView = () => call<AdminView>('GET', '/admin');
export const approveAccess = (uid: string) => call<{ ok: true }>('POST', '/admin/approve', { uid });
export const rejectAccess = (uid: string) => call<{ ok: true }>('POST', '/admin/reject', { uid });
export const revokeAccess = (uid: string) =>
  call<{ ok: true; grantsRevoked: number }>('POST', '/admin/revoke', { uid });
