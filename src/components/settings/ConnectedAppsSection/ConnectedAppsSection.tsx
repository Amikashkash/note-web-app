/**
 * "אפליקציות מחוברות" בהגדרות: החיבורים של המשתמש ל-Claude (שרת ה-MCP),
 * עם ניתוק. ניתוק מבטל מיד את כל ה-tokens של החיבור.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import { listMcpConnections, revokeMcpConnection, type McpConnection } from '@/services/api/mcpGrants';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';

const MCP_URL = 'https://notes-4-me.web.app/mcp';

const formatDate = (date: Date | null): string =>
  date ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'לא ידוע';

type Load = { kind: 'loading' } | { kind: 'loaded'; connections: McpConnection[] } | { kind: 'error'; message: string };

export const ConnectedAppsSection: React.FC = () => {
  const uid = useAuthStore((state) => state.user?.uid);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      setLoad({ kind: 'loaded', connections: await listMcpConnections(uid) });
    } catch (error) {
      logger.error('Error loading MCP connections:', error);
      setLoad({ kind: 'error', message: 'לא ניתן לטעון את החיבורים כרגע.' });
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = async (connection: McpConnection) => {
    if (!window.confirm(`לנתק את ${connection.clientName}? הגישה לפתקים תיחסם מיד.`)) return;
    setRevoking(connection.grantId);
    setRevokeError(null);
    try {
      await revokeMcpConnection(connection.grantId);
      await refresh();
    } catch (error) {
      setRevokeError(getErrorMessage(error));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md p-6 transition-colors">
      <h2 className="text-xl font-bold text-ink-light dark:text-ink-dark mb-2">🔌 אפליקציות מחוברות</h2>
      <p className="text-sm text-ink-2-light dark:text-ink-2-dark mb-4">
        אפליקציות שקיבלו ממך גישת קריאה לפתקים, כמו Claude. פתקים וקטגוריות שסימנת כרגישים לא נגישים להן.
      </p>

      {load.kind === 'loading' && <p className="text-sm text-ink-2-light dark:text-ink-2-dark">טוען...</p>}
      {load.kind === 'error' && <p className="text-sm text-danger dark:text-danger-dark">{load.message}</p>}

      {load.kind === 'loaded' && load.connections.length === 0 && (
        <div className="text-sm text-ink-2-light dark:text-ink-2-dark space-y-1">
          <p>אין אפליקציות מחוברות.</p>
          <p>
            לחיבור Claude: ב-claude.ai, בהגדרות ← Connectors ← Add custom connector, עם הכתובת{' '}
            <span dir="ltr" className="font-mono">
              {MCP_URL}
            </span>
          </p>
        </div>
      )}

      {load.kind === 'loaded' && load.connections.length > 0 && (
        <ul className="divide-y divide-hairline-light dark:divide-hairline-dark">
          {load.connections.map((connection) => (
            <li key={connection.grantId} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-ink-light dark:text-ink-dark truncate">
                  <bdi>{connection.clientName}</bdi>
                </p>
                <p className="text-xs text-ink-2-light dark:text-ink-2-dark">
                  חובר ב-{formatDate(connection.createdAt)} · שימוש אחרון: {formatDate(connection.lastUsedAt)}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                isLoading={revoking === connection.grantId}
                disabled={revoking !== null}
                onClick={() => revoke(connection)}
              >
                ניתוק
              </Button>
            </li>
          ))}
        </ul>
      )}

      {revokeError && <p className="text-sm text-danger dark:text-danger-dark mt-3">{revokeError}</p>}
    </div>
  );
};
