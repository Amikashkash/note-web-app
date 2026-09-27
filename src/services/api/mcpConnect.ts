/**
 * מסך ההסכמה לחיבור Claude מול `/oauth/decision` (functions/src/oauth/decision.ts).
 *
 * הזהות עוברת ב-`Authorization: Bearer <Firebase ID token>`, לא ב-cookie:
 * אתר אחר לא יכול לשלוח את ה-header הזה בשם המשתמש. הכתובת יחסית, כי
 * ה-endpoint יושב באותו origin דרך rewrite של Hosting (שלב 1ג).
 */

import { auth } from '@/services/firebase/config';
import {
  parseConnectRequest,
  problemFrom,
  safeRedirect,
  type ConnectProblem,
  type ConnectRequest,
} from '@/utils/mcpConnect';

const ENDPOINT = '/oauth/decision';

export type ConnectResult<T> = { ok: true; value: T } | { ok: false; problem: ConnectProblem };

const idToken = async (): Promise<string | null> => {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
};

const call = async (init: RequestInit & { query?: string }): Promise<ConnectResult<unknown>> => {
  const token = await idToken();
  if (!token) return { ok: false, problem: 'login_required' };

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${init.query ?? ''}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { ok: false, problem: 'unavailable' };
  }

  const body: unknown = await response.json().catch(() => null);
  return response.ok ? { ok: true, value: body } : { ok: false, problem: problemFrom(response.status, body) };
};

/** פרטי הבקשה לתצוגה. גם קושר את הבקשה למשתמש המחובר ומקבל nonce */
export const loadConnectRequest = async (reqId: string): Promise<ConnectResult<ConnectRequest>> => {
  const result = await call({ method: 'GET', query: `?req=${encodeURIComponent(reqId)}` });
  if (!result.ok) return result;
  const request = parseConnectRequest(result.value);
  return request ? { ok: true, value: request } : { ok: false, problem: 'unavailable' };
};

/** אישור או דחייה. מחזיר את ה-URL לחזרה ל-Claude, רק אם הוא לאתר שהוצג */
export const sendConnectDecision = async (
  reqId: string,
  request: ConnectRequest,
  approve: boolean
): Promise<ConnectResult<string>> => {
  const result = await call({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ req: reqId, nonce: request.nonce, approve }),
  });
  if (!result.ok) return result;

  const redirectTo = safeRedirect((result.value as { redirectTo?: unknown } | null)?.redirectTo, request.redirectHost);
  return redirectTo ? { ok: true, value: redirectTo } : { ok: false, problem: 'unavailable' };
};
