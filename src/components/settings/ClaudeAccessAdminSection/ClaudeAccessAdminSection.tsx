/**
 * ניהול הגישה ל-Claude, בהגדרות (v1.43.0). מוצג רק למנהל: "האם אני מנהל"
 * מגיע מהשרת (`/oauth/access/status`), וכל פעולה נבדקת שם שוב מול
 * `config/mcp.adminUids`. הסתרה כאן היא נוחות, לא ההגנה.
 *
 * - בקשות שממתינות: אישור (נוסף ל-`allowedUids`) או דחייה.
 * - מורשים: "בטל גישה" - יוצא מהרשימה, וכל החיבורים שלו ל-Claude מנותקים מיד.
 * - `openToAll` לא משתנה מכאן. כשהוא פתוח, זה כתוב, כי אז הרשימה לא קובעת.
 *
 * ההתראה על בקשה חדשה מובילה לכאן (`/settings#claude-access`).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import {
  approveAccess,
  getAccessStatus,
  getAdminView,
  rejectAccess,
  revokeAccess,
  type AccessUser,
  type AdminView,
} from '@/services/api/mcpAccess';
import { getErrorMessage } from '@/utils/errors';

export const SECTION_ID = 'claude-access';

type Load = { kind: 'checking' } | { kind: 'hidden' } | { kind: 'loaded'; view: AdminView } | { kind: 'error'; message: string };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const label = (user: AccessUser) => user.name || user.email || user.uid;

export const ClaudeAccessAdminSection: React.FC = () => {
  const myUid = useAuthStore((state) => state.user?.uid);
  const location = useLocation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ kind: 'checking' });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'loaded', view: await getAdminView() });
    } catch (error) {
      setLoad({ kind: 'error', message: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAccessStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.admin) void refresh();
        else setLoad({ kind: 'hidden' });
      })
      // בלי שרת (למשל offline) אין דרך לדעת - לא מציגים כלום
      .catch(() => !cancelled && setLoad({ kind: 'hidden' }));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // מההתראה: גוללים למקטע כשהוא מוכן
  const loaded = load.kind === 'loaded';
  useEffect(() => {
    if (loaded && location.hash === `#${SECTION_ID}`) sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [loaded, location.hash]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (load.kind === 'checking' || load.kind === 'hidden') return null;

  const revoke = (user: AccessUser) => {
    const self = user.uid === myUid;
    const question = self
      ? 'לבטל את הגישה שלך עצמך? החיבורים שלך ל-Claude ינותקו מיד. כמנהל תוכל לבקש ולאשר שוב.'
      : `לבטל את הגישה של ${label(user)}? החיבורים שלו ל-Claude ינותקו מיד.`;
    if (window.confirm(question)) void run(`revoke-${user.uid}`, () => revokeAccess(user.uid));
  };

  return (
    <div
      id={SECTION_ID}
      ref={sectionRef}
      className="scroll-mt-4 bg-surface-light dark:bg-surface-dark rounded-lg shadow-md p-6 transition-colors"
    >
      <h2 className="text-xl font-bold text-ink-light dark:text-ink-dark mb-2">🛡️ גישה ל-Claude - ניהול</h2>
      <p className="text-sm text-ink-2-light dark:text-ink-2-dark mb-4">
        מוצג רק לך, כמנהל. אישור מאפשר לחשבון לחבר את Claude לפתקים שלו - רק לפתקים שלו.
      </p>

      {load.kind === 'error' && <p className="text-sm text-danger dark:text-danger-dark">{load.message}</p>}
      {actionError && (
        <p role="alert" className="mb-3 text-sm text-danger dark:text-danger-dark">
          {actionError}
        </p>
      )}

      {load.kind === 'loaded' && (
        <div className="space-y-6">
          {load.view.openToAll && (
            <p role="note" className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 p-3 text-sm">
              ב-config/mcp מוגדר openToAll: כל חשבון מחובר יכול לחבר את Claude, והרשימה למטה לא קובעת. ביטול גישה כאן
              מנתק את החיבורים הקיימים, אבל לא מונע חיבור חדש. הערך הזה משתנה רק ב-console.
            </p>
          )}

          <section>
            <h3 className="text-h2 text-ink-light dark:text-ink-dark mb-2">
              ממתינות לאישור ({load.view.pending.length})
            </h3>
            {load.view.pending.length === 0 ? (
              <p className="text-sm text-ink-2-light dark:text-ink-2-dark">אין בקשות.</p>
            ) : (
              <ul className="divide-y divide-hairline-light dark:divide-hairline-dark">
                {load.view.pending.map((request) => (
                  <li key={request.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-medium text-ink-light dark:text-ink-dark truncate">{request.name || request.email}</p>
                      <p className="text-body-sm text-ink-2-light dark:text-ink-2-dark truncate" dir="ltr">
                        {request.email}
                      </p>
                      <p className="text-body-sm text-ink-3-light dark:text-ink-3-dark">ביקש ב-{formatDate(request.requestedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        isLoading={busy === `approve-${request.uid}`}
                        disabled={busy !== null}
                        onClick={() => run(`approve-${request.uid}`, () => approveAccess(request.uid))}
                      >
                        אישור
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={busy === `reject-${request.uid}`}
                        disabled={busy !== null}
                        onClick={() => run(`reject-${request.uid}`, () => rejectAccess(request.uid))}
                      >
                        דחייה
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-h2 text-ink-light dark:text-ink-dark mb-2">מורשים ({load.view.approved.length})</h3>
            {load.view.approved.length === 0 ? (
              <p className="text-sm text-ink-2-light dark:text-ink-2-dark">אין משתמשים מורשים.</p>
            ) : (
              <ul className="divide-y divide-hairline-light dark:divide-hairline-dark">
                {load.view.approved.map((user) => (
                  <li key={user.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-medium text-ink-light dark:text-ink-dark truncate">
                        {label(user)}
                        {user.uid === myUid && <span className="text-ink-3-light dark:text-ink-3-dark"> (את/ה)</span>}
                      </p>
                      {user.email && (
                        <p className="text-body-sm text-ink-2-light dark:text-ink-2-dark truncate" dir="ltr">
                          {user.email}
                        </p>
                      )}
                      {!user.email && !user.name && (
                        <p className="text-body-sm text-ink-3-light dark:text-ink-3-dark">החשבון לא נמצא (אולי נמחק)</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={busy === `revoke-${user.uid}`}
                      disabled={busy !== null}
                      onClick={() => revoke(user)}
                    >
                      בטל גישה
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
