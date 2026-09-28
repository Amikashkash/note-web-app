/**
 * "פעילות Claude": מה Claude עשה בשם המשתמש, מתוך `auditLog`.
 *
 * כל כתיבה דרך שרת ה-MCP נרשמת שם באותו transaction של הכתיבה עצמה, כך
 * שאין שינוי בלי רשומה: יצירת פתק, עדכון משימה, הוספת טקסט.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { listClaudeActivity, type ClaudeActivity as Activity } from '@/services/api/mcpGrants';
import { getTemplateLabel } from '@/utils/templates';
import { logger } from '@/utils/logger';

type Load = { kind: 'loading' } | { kind: 'loaded'; entries: Activity[] } | { kind: 'error' };

const formatWhen = (date: Date | null): string =>
  date
    ? date.toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

const describe = (entry: Activity): string => {
  if (entry.action !== 'note.create') return entry.description;
  const parts = [getTemplateLabel(entry.templateType)];
  if (entry.itemCount > 0) parts.push(`${entry.itemCount} פריטים`);
  if (entry.reminderCount > 0) parts.push(`${entry.reminderCount} תזכורות`);
  if (entry.categoryName) parts.push(`בקטגוריה ${entry.categoryName}`);
  return parts.join(' · ');
};

export const ClaudeActivity: React.FC<{ uid: string }> = ({ uid }) => {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listClaudeActivity(uid).then(
      (entries) => {
        if (!cancelled) setLoad({ kind: 'loaded', entries });
      },
      (error: unknown) => {
        logger.error('Error loading Claude activity:', error);
        if (!cancelled) setLoad({ kind: 'error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-ink-light dark:text-ink-dark mb-2 inline-flex items-center gap-1.5">
        <Sparkles size={16} strokeWidth={2} />
        פעילות Claude
      </h3>

      {load.kind === 'loading' && <p className="text-sm text-ink-2-light dark:text-ink-2-dark">טוען...</p>}
      {load.kind === 'error' && (
        <p className="text-sm text-ink-2-light dark:text-ink-2-dark">לא ניתן לטעון את הפעילות כרגע.</p>
      )}
      {load.kind === 'loaded' && load.entries.length === 0 && (
        <p className="text-sm text-ink-2-light dark:text-ink-2-dark">Claude עוד לא יצר או שינה פתקים.</p>
      )}

      {load.kind === 'loaded' && load.entries.length > 0 && (
        <ul className="space-y-2">
          {load.entries.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="text-ink-light dark:text-ink-dark">
                <bdi>{entry.clientName}</bdi> {entry.action === 'note.create' ? 'יצר את' : 'עדכן את'}{' '}
                {entry.categoryId && entry.noteId ? (
                  <Link
                    to={`/category/${encodeURIComponent(entry.categoryId)}?note=${encodeURIComponent(entry.noteId)}`}
                    className="font-medium text-brand dark:text-brand-dark hover:underline"
                  >
                    <bdi>{entry.title || 'פתק'}</bdi>
                  </Link>
                ) : (
                  <bdi className="font-medium">{entry.title || 'פתק'}</bdi>
                )}
              </p>
              <p className="text-xs text-ink-2-light dark:text-ink-2-dark">
                {formatWhen(entry.at)} · {describe(entry)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
