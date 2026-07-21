/**
 * גיבוי הפתקים לקובץ להורדה
 *
 * שני פורמטים: Markdown לקריאה בעיניים, ו-JSON לשחזור מדויק.
 */

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import { fetchBackupData } from '@/services/api/backup';
import {
  backupFileName,
  buildJsonBackup,
  buildMarkdownBackup,
  type BackupMeta,
} from '@/utils/backupFormat';
import { downloadTextFile } from '@/utils/download';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';

type Format = 'md' | 'json';

const FORMATS: Record<Format, { mimeType: string; build: typeof buildMarkdownBackup }> = {
  md: { mimeType: 'text/markdown', build: buildMarkdownBackup },
  json: { mimeType: 'application/json', build: buildJsonBackup },
};

export const BackupSection: React.FC = () => {
  const { user } = useAuthStore();
  // נשמר הפורמט ולא רק דגל בוליאני, כדי שרק הכפתור שנלחץ יראה "מכין..."
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: Format) => {
    if (!user) return;

    setDownloading(format);
    setStatus(null);
    setError(null);

    try {
      const { notes, categories } = await fetchBackupData(user.uid);

      const createdAt = new Date();
      const meta: BackupMeta = {
        userId: user.uid,
        userEmail: user.email ?? '',
        appVersion: __APP_VERSION__,
        createdAt,
      };

      const { mimeType, build } = FORMATS[format];
      downloadTextFile(
        backupFileName(format, createdAt),
        build(notes, categories, meta),
        mimeType
      );

      const archived = notes.filter((note) => note.isArchived).length;
      setStatus(
        `הקובץ ירד — ${notes.length} פתקים ב-${categories.length} קטגוריות` +
          (archived > 0 ? ` (כולל ${archived} בארכיון)` : '')
      );
    } catch (caught) {
      logger.error('Error creating backup:', caught);
      setError(getErrorMessage(caught));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md p-6 transition-colors">
      <h2 className="text-xl font-bold text-ink-light dark:text-ink-dark mb-2">💾 גיבוי הפתקים</h2>
      <p className="text-sm text-ink-2-light dark:text-ink-2-dark mb-6">
        הורדה של כל הפתקים והקטגוריות שלך לקובץ במחשב, כולל פתקים בארכיון. שמור את הקובץ במקום
        בטוח — כך תוכל לשחזר את התוכן גם אם תהיה תקלה באפליקציה.
      </p>

      <div className="space-y-4">
        {/* Markdown - קריא */}
        <div className="border border-hairline-light dark:border-hairline-dark rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink-light dark:text-ink-dark">📄 קובץ קריא (Markdown)</h3>
              <p className="text-sm text-ink-3-light dark:text-ink-3-dark mt-1">
                כל הפתקים מסודרים לפי קטגוריה, בטקסט שאפשר לקרוא בכל עורך טקסט.
              </p>
            </div>
            <Button
              onClick={() => handleDownload('md')}
              isLoading={downloading === 'md'}
              disabled={downloading !== null}
            >
              הורד
            </Button>
          </div>
        </div>

        {/* JSON - לשחזור */}
        <div className="border border-hairline-light dark:border-hairline-dark rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink-light dark:text-ink-dark">🗄️ גיבוי מלא (JSON)</h3>
              <p className="text-sm text-ink-3-light dark:text-ink-3-dark mt-1">
                כל הנתונים במדויק — צבעים, תגיות, תזכורות וסדר. פחות נוח לקריאה, אבל זה הקובץ
                שממנו אפשר לשחזר הכול.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => handleDownload('json')}
              isLoading={downloading === 'json'}
              disabled={downloading !== null}
            >
              הורד
            </Button>
          </div>
        </div>

        {status && (
          <p className="text-sm text-success dark:text-success-dark">✓ {status}</p>
        )}
        {error && <p className="text-sm text-danger dark:text-danger-dark">✗ {error}</p>}
      </div>

      <div className="mt-6 pt-6 border-t border-hairline-light dark:border-hairline-dark">
        <p className="text-sm text-ink-2-light dark:text-ink-2-dark">
          💡 מומלץ להוריד גיבוי מדי פעם. הקובץ נוצר במכשיר שלך ואינו נשלח לשום מקום.
        </p>
      </div>
    </div>
  );
};
