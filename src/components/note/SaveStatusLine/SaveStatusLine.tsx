/**
 * שורת המצב של העורך (צעד 6 בסבב 2): האם מה שמוצג נשמר. ההחלטה ב-
 * `utils/saveStatus.ts`; כאן רק התצוגה. ההסבר המלא ב-title ולקוראי מסך.
 */

import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import type { SaveStatus } from '@/utils/saveStatus';

const LOOK = {
  saved: { Icon: Check, className: 'text-ink-3-light dark:text-ink-3-dark' },
  saving: { Icon: Loader2, className: 'text-ink-3-light dark:text-ink-3-dark' },
  offline: { Icon: CloudOff, className: 'text-amber-700 dark:text-amber-400' },
  unsaved: { Icon: AlertTriangle, className: 'text-red-700 dark:text-red-400 font-medium' },
} as const;

export const SaveStatusLine: React.FC<{ status: SaveStatus }> = ({ status }) => {
  const { Icon, className } = LOOK[status.kind];
  return (
    <span role="status" aria-live="polite" title={status.detail} className={`inline-flex items-center gap-1 ${className}`}>
      <Icon size={14} strokeWidth={2} aria-hidden className={status.kind === 'saving' ? 'animate-spin' : undefined} />
      {status.label}
      <span className="sr-only"> - {status.detail}</span>
    </span>
  );
};
