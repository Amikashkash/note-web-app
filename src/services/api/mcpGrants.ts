/**
 * "אפליקציות מחוברות": החיבורים של המשתמש לשרת ה-MCP (Claude).
 *
 * - רשימה: קריאה ישירה של `oauthGrants` לפי `uid`. ה-rules מתירים לבעלים
 *   לקרוא רק את החיבורים שלו, ולא לכתוב בהם.
 * - ניתוק: `POST /oauth/grants/revoke` בפונקציית `mcp` (`revokeMcpGrant`),
 *   עם Firebase ID token. הפונקציה מבטלת את החיבור ואת כל ה-tokens שלו.
 */

import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';
import { logger } from '@/utils/logger';

export interface McpConnection {
  grantId: string;
  clientName: string;
  createdAt: Date | null;
  lastUsedAt: Date | null;
}

const asDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

/** החיבורים הפעילים: לא בוטלו ולא עברו את התקרה של 90 יום */
export const listMcpConnections = async (uid: string): Promise<McpConnection[]> => {
  const snapshot = await getDocs(query(collection(db, 'oauthGrants'), where('uid', '==', uid)));
  const now = Date.now();

  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      const expires = asDate(data.absoluteExpiresAt);
      return data.revoked !== true && expires !== null && expires.getTime() > now;
    })
    .map((doc) => {
      const data = doc.data();
      return {
        grantId: doc.id,
        clientName: typeof data.clientName === 'string' && data.clientName ? data.clientName : 'MCP client',
        createdAt: asDate(data.createdAt),
        lastUsedAt: asDate(data.lastUsedAt),
      };
    })
    .sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0));
};

export const revokeMcpConnection = async (grantId: string): Promise<void> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('צריך להתחבר מחדש');

  let response: Response;
  try {
    response = await fetch('/oauth/grants/revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantId }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (error) {
    logger.error('Error revoking MCP connection:', error);
    throw new Error('אין חיבור לשרת. נסו שוב.', { cause: error });
  }
  if (!response.ok) {
    logger.error('Revoking MCP connection failed with status', response.status);
    throw new Error('הניתוק נכשל. רעננו את הדף ונסו שוב.');
  }
};

/** פעולה אחת של Claude, מתוך `auditLog` (נכתב רק בשרת, קריא רק לבעלים) */
export interface ClaudeActivity {
  id: string;
  at: Date | null;
  /** `note.create`, `checklist_item.update`, `note.archive`, `note.move`... */
  action: string;
  /** בעריכה: תיאור קצר של השינוי */
  description: string;
  clientName: string;
  noteId: string;
  title: string;
  templateType: string;
  categoryId: string;
  categoryName: string;
  itemCount: number;
  reminderCount: number;
}

const ACTIVITY_LIMIT = 20;

/** הפעולות האחרונות של Claude בשם המשתמש, מהחדשה לישנה */
export const listClaudeActivity = async (uid: string): Promise<ClaudeActivity[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'auditLog'), where('uid', '==', uid), orderBy('at', 'desc'), limit(ACTIVITY_LIMIT))
  );
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const summary = (data.summary ?? {}) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const count = (value: unknown) => (typeof value === 'number' ? value : 0);
    return {
      id: doc.id,
      at: asDate(data.at),
      action: text(data.action) || 'note.create',
      description: text(summary.description),
      clientName: text(data.clientName) || 'MCP client',
      noteId: text((data.target as { id?: unknown } | undefined)?.id),
      title: text(summary.title),
      templateType: text(summary.templateType),
      categoryId: text(summary.categoryId),
      categoryName: text(summary.categoryName),
      itemCount: count(summary.itemCount),
      reminderCount: count(summary.reminderCount),
    };
  });
};
